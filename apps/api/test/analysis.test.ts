import { expect, test } from "vitest";
import { computeAnalysis, overlappingIntervals } from "../src/transcripts/analysis.js";
import { seg } from "./helpers.js";

test("empty input yields all-zero metrics", () => {
  expect(computeAnalysis([])).toEqual({
    totalConversationTime: 0,
    totalTalkingTime: 0,
    numberOfInterruptions: 0,
    totalSilence: 0,
  });
});

test("two back-to-back non-overlapping segments: no overlap, no silence", () => {
  // user 0-1000, agent 1000-2500
  const m = computeAnalysis([seg("user", 0, 1000), seg("agent", 1000, 2500)]);
  expect(m.totalConversationTime).toBe(2500); // 2500 - 0
  expect(m.totalTalkingTime).toBe(2500); // union, no overlap
  expect(m.numberOfInterruptions).toBe(0);
  expect(m.totalSilence).toBe(0);
});

test("a gap between segments counts as silence", () => {
  // user 0-1000, agent 2000-3000 -> 1000ms gap
  const m = computeAnalysis([seg("user", 0, 1000), seg("agent", 2000, 3000)]);
  expect(m.totalConversationTime).toBe(3000);
  expect(m.totalTalkingTime).toBe(2000); // 1000 + 1000
  expect(m.totalSilence).toBe(1000);
  expect(m.numberOfInterruptions).toBe(0);
});

test("an overlap counts as one interruption and reduces talking time below the raw sum", () => {
  // user 0-1000, agent 800-1800 -> overlap 800-1000 (200ms)
  const m = computeAnalysis([seg("user", 0, 1000), seg("agent", 800, 1800)]);
  expect(m.totalConversationTime).toBe(1800);
  expect(m.totalTalkingTime).toBe(1800); // union: 0-1800
  expect(m.numberOfInterruptions).toBe(1);
  expect(m.totalSilence).toBe(0);
});

test("overlappingIntervals returns each interrupting pair", () => {
  const pairs = overlappingIntervals([seg("user", 0, 1000), seg("agent", 800, 1800)]);
  expect(pairs.length).toBe(1);
  expect(pairs[0][1].role).toBe("agent");
});
