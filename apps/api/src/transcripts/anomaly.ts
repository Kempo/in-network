import { SpeechSegment } from "./analysis.js";

export const SILENCE_THRESHOLD_MS = 3000;

export type AnomalyCandidate =
  | { type: "silence"; segmentIndex: number; gapStart: number; gapEnd: number }
  | { type: "interruption"; segmentIndex: number };

export function detectAnomalyCandidates(segments: SpeechSegment[]): AnomalyCandidate[] {
  const indexed = segments
    .map((s, index) => ({ ...s, index }))
    .toSorted((a, b) => a.startedAt - b.startedAt);

  const candidates: AnomalyCandidate[] = [];

  let curr = indexed[0];

  for (let i = 1; i < indexed.length; i++) {
    const next = indexed[i];

    if (next.startedAt < curr.endedAt) {
      if (next.role === "user") {
        candidates.push({ type: "interruption", segmentIndex: next.index });
      }
    } else if (next.startedAt - curr.endedAt > SILENCE_THRESHOLD_MS) {
      candidates.push({
        type: "silence",
        segmentIndex: curr.index,
        gapStart: curr.endedAt,
        gapEnd: next.startedAt,
      });
    }

    if (next.endedAt > curr.endedAt) {
      curr = next;
    }
  }
  return candidates;
}