import { beforeAll, afterAll, expect, test, vi } from "vitest";
import { config } from "dotenv";
config({ path: "../../.env" });

vi.mock("../src/transcripts/title.js", () => ({
  generateTitle: vi.fn(async () => "Test generated title"),
}));

vi.mock("../src/transcripts/classify.js", () => ({
  classifyAnomalies: vi.fn(async (_title: string, _segments: unknown[], candidates: unknown[]) =>
    candidates.map(() => ({ reason: "Test reason", actionable: true, recommendation: "Test rec" })),
  ),
}));

const { pool, waitForDb, runMigrations } = await import("../src/db/client.js");
const { buildApp } = await import("../src/app.js");

let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  await waitForDb();
  await runMigrations();
  app = buildApp();
});
afterAll(async () => {
  await pool.end();
});

const body = JSON.stringify([
  { speaker: "agent", started_at: 0, ended_at: 500, text: "Thanks for calling." },
  { speaker: "customer", started_at: 600, ended_at: 1400, text: "I lost my card." },
  { speaker: "agent", started_at: 1300, ended_at: 2000, text: "I can help with that." },
]);

const post = (b: string) =>
  app.request("/transcripts", { method: "POST", headers: { "content-type": "application/json" }, body: b });

test("POST creates a transcript, its segments, and analysis", async () => {
  const res = await post(body);
  expect(res.status).toBe(201);
  const { transcript } = await res.json();
  expect(transcript.title).toBe("Test generated title");
  expect(transcript.preview).toBe("I lost my card.");
  expect(typeof transcript.id).toBe("number");

  const detail = await (await app.request(`/transcripts/${transcript.id}`)).json();
  expect(detail.segments.length).toBe(3);
  expect(detail.analysis.numberOfInterruptions).toBe(1); // agent 1300 starts before customer 1400 ends
  expect(detail.analysis.totalConversationTime).toBe(2000);
  expect(detail.anomalies).toEqual([]); // no >3s gap, and the only interrupter is the agent
});

test("GET / lists transcripts with analysis fields", async () => {
  await post(body);
  const res = await app.request("/transcripts");
  expect(res.status).toBe(200);
  const { transcripts } = await res.json();
  expect(transcripts.length).toBeGreaterThan(0);
  expect(transcripts[0]).toHaveProperty("totalConversationTime");
  expect(transcripts[0]).toHaveProperty("preview");
});

test("POST rejects a malformed body with 400", async () => {
  const res = await post(JSON.stringify([{ speaker: "bot", started_at: 0, ended_at: 1, text: "x" }]));
  expect(res.status).toBe(400);
});

test("GET /:id returns 404 for an unknown id", async () => {
  const res = await app.request("/transcripts/999999");
  expect(res.status).toBe(404);
});

const anomalyBody = JSON.stringify([
  { speaker: "agent", started_at: 0, ended_at: 1000, text: "Let me look that up." },
  { speaker: "agent", started_at: 6000, ended_at: 8000, text: "Found it, you owe fifty dollars." },
  { speaker: "customer", started_at: 7500, ended_at: 9000, text: "Wait, fifty? It said forty." },
]);

test("POST stores anomalies for silence gaps and customer interruptions", async () => {
  const res = await post(anomalyBody);
  expect(res.status).toBe(201);
  const { transcript } = await res.json();

  const detail = await (await app.request(`/transcripts/${transcript.id}`)).json();
  expect(detail.anomalies.length).toBe(2);

  const byId = new Map(detail.segments.map((s: { id: number }) => [s.id, s]));
  const silence = detail.anomalies.find((a: { type: string }) => a.type === "silence");
  const interruption = detail.anomalies.find((a: { type: string }) => a.type === "interruption");

  // silence (1000→6000ms gap) attaches to the segment BEFORE the gap
  expect((byId.get(silence.speechSegmentId) as { text: string }).text).toBe("Let me look that up.");
  // interruption attaches to the customer's interrupting segment
  expect((byId.get(interruption.speechSegmentId) as { text: string }).text).toBe("Wait, fifty? It said forty.");

  expect(silence.reason).toBe("Test reason");
  expect(silence.actionable).toBe(true);
  expect(silence.recommendation).toBe("Test rec");
});
