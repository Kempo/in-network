import { expect, test } from "vitest";
import { parseSegments, previewFrom } from "../src/transcripts/parse.js";

const raw = [
  { speaker: "agent", started_at: 0, ended_at: 500, text: "Hi there" },
  { speaker: "customer", started_at: 600, ended_at: 1200, text: "I need help" },
];

test("maps speaker->role (customer->user) and snake_case timestamps", () => {
  const parsed = parseSegments(raw);
  expect(parsed).toEqual([
    { role: "agent", startedAt: 0, endedAt: 500, text: "Hi there" },
    { role: "user", startedAt: 600, endedAt: 1200, text: "I need help" },
  ]);
});

test("preview is the first user segment's text by startedAt", () => {
  expect(previewFrom(parseSegments(raw))).toBe("I need help");
});

test("rejects a malformed segment", () => {
  expect(() => parseSegments([{ speaker: "bot", started_at: 0, ended_at: 1, text: "x" }])).toThrow();
});
