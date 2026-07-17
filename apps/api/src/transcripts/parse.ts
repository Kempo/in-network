import { z } from "zod";

const segmentSchema = z.object({
  speaker: z.enum(["customer", "agent"]),
  started_at: z.number().int(),
  ended_at: z.number().int(),
  text: z.string(),
});

const bodySchema = z.array(segmentSchema);

export type ParsedSegment = { role: "user" | "agent"; text: string; startedAt: number; endedAt: number };

export function parseSegments(raw: unknown): ParsedSegment[] {
  return bodySchema.parse(raw).map((s) => ({
    role: s.speaker === "customer" ? "user" : "agent",
    text: s.text,
    startedAt: s.started_at,
    endedAt: s.ended_at,
  }));
}

export function previewFrom(parsed: ParsedSegment[]): string {
  const users = parsed.filter((s) => s.role === "user").sort((a, b) => a.startedAt - b.startedAt);
  return users[0]?.text ?? "";
}
