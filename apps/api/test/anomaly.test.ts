
import { expect, test } from "vitest";
import { detectAnomalyCandidates } from "../src/transcripts/anomaly.js";
import { seg } from "./helpers.js";

test("silence gap > 3000ms yields a candidate attached to the prior segment", () => {
  const c = detectAnomalyCandidates([seg("agent", 0, 1000), seg("user", 4500, 5000)]);
  expect(c).toEqual([{ type: "silence", segmentIndex: 0, gapStart: 1000, gapEnd: 4500 }]);
});

test("a gap of exactly 3000ms is not a candidate", () => {
  expect(detectAnomalyCandidates([seg("agent", 0, 1000), seg("user", 4000, 5000)])).toEqual([]);
});

test("customer starting during agent speech is an interruption candidate", () => {
  const c = detectAnomalyCandidates([seg("agent", 0, 2000), seg("user", 1500, 2500)]);
  expect(c).toEqual([{ type: "interruption", segmentIndex: 1 }]);
});

test("agent interrupting the customer is not a candidate", () => {
  expect(detectAnomalyCandidates([seg("user", 0, 2000), seg("agent", 1500, 2500)])).toEqual([]);
});

test("silence after an overlapping block attaches to the segment that spoke last", () => {
  // agent 0-1000, user 800-2000 overlap into one block ending at 2000; gap 2000→5500
  const c = detectAnomalyCandidates([seg("agent", 0, 1000), seg("user", 800, 2000), seg("agent", 5500, 6000)]);
  expect(c).toContainEqual({ type: "silence", segmentIndex: 1, gapStart: 2000, gapEnd: 5500 });
});

test("empty and single-segment input yield no candidates", () => {
  expect(detectAnomalyCandidates([])).toEqual([]);
  expect(detectAnomalyCandidates([seg("agent", 0, 1000)])).toEqual([]);
});
