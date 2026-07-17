import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AnomalyCandidate } from "./anomaly.js";
import type { ParsedSegment } from "./parse.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const resultSchema = z.array(
  z.object({
    reason: z.string(),
    actionable: z.boolean(),
    recommendation: z.string().nullable(),
  }),
);

export type ClassifiedAnomaly = z.infer<typeof resultSchema>[number];

const SYSTEM =
  "You analyze customer-support call transcripts between a customer and an AI agent. " +
  "You are given a call transcript and a numbered list of detected anomalies (silences and customer interruptions). " +
  "For each anomaly, judge WHY it happened and whether it is ACTIONABLE for improving the agent:\n" +
  "- A silence is actionable when the agent was expected to respond or complete a task and took too long " +
  "(e.g. a slow account or deductible lookup). It is not actionable when the pause is on the customer's side " +
  "(finding a card, thinking, writing something down).\n" +
  "- An interruption is actionable when the customer is questioning or correcting incorrect information the agent gave. " +
  "It is not actionable when the customer is merely assenting or reacting (\"okay\", \"that's great\").\n" +
  "Respond with ONLY a JSON array, one entry per anomaly in the same order, shaped: " +
  '{"reason": string, "actionable": boolean, "recommendation": string | null}. ' +
  "reason: one sentence on why it happened. recommendation: one sentence on what to look into, or null when not actionable.";

function describeCandidate(c: AnomalyCandidate, i: number, segments: ParsedSegment[]): string {
  if (c.type === "silence") {
    const prior = segments[c.segmentIndex];
    return `${i + 1}. silence of ${c.gapEnd - c.gapStart}ms starting at ${c.gapStart}ms, right after ${prior.role}: "${prior.text}"`;
  }
  const seg = segments[c.segmentIndex];
  const interrupted = segments.find((s) => s.startedAt < seg.startedAt && s.endedAt > seg.startedAt);
  return `${i + 1}. interruption at ${seg.startedAt}ms: customer cut in on agent saying "${interrupted?.text ?? "(unknown)"}" with "${seg.text}"`;
}

export async function classifyAnomalies(
  title: string,
  segments: ParsedSegment[],
  candidates: AnomalyCandidate[],
): Promise<ClassifiedAnomaly[]> {
  if (candidates.length === 0) return [];

  const transcript = segments
    .map((s) => `[${s.startedAt}-${s.endedAt}] ${s.role}: ${s.text}`)
    .join("\n");
  const anomalyList = candidates.map((c, i) => describeCandidate(c, i, segments)).join("\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Call title: ${title}\n\nTranscript:\n${transcript}\n\nAnomalies to classify:\n${anomalyList}`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === "text");
  const raw = (block && "text" in block ? block.text : "[]").trim();
  const stripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = resultSchema.parse(JSON.parse(stripped));
  if (parsed.length !== candidates.length) {
    throw new Error(`classification returned ${parsed.length} entries for ${candidates.length} anomalies`);
  }
  return parsed;
}
