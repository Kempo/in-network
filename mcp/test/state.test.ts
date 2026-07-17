import { describe, expect, test } from "vitest";
import { createState } from "../src/state.js";

test("initial state: both gated tools are closed", () => {
  const s = createState();
  expect(s.canSaveProvider()).toBe(false);
  expect(s.canGetSearchStatus()).toBe(false);
});

describe("recordProviderSearch", () => {
  test("npi candidates unlock save_provider", () => {
    const s = createState();
    s.recordProviderSearch({ providers: [{ source: "npi" }] });
    expect(s.canSaveProvider()).toBe(true);
  });

  test("db-only matches do not unlock save_provider", () => {
    const s = createState();
    s.recordProviderSearch({ providers: [{ source: "db" }] });
    expect(s.canSaveProvider()).toBe(false);
  });
});

describe("run tracking", () => {
  test("starting a run unlocks get_search_status", () => {
    const s = createState();
    s.recordSearchStarted({ runId: 5 });
    expect(s.canGetSearchStatus()).toBe(true);
  });

  test("a finished run re-locks get_search_status", () => {
    const s = createState();
    s.recordSearchStarted({ runId: 5 });
    s.recordSearchStatus(5, { status: "finished" });
    expect(s.canGetSearchStatus()).toBe(false);
  });

  test("a failed run re-locks get_search_status", () => {
    const s = createState();
    s.recordSearchStarted({ runId: 5 });
    s.recordSearchStatus(5, { status: "failed" });
    expect(s.canGetSearchStatus()).toBe(false);
  });

  test("a 'processing' status keeps get_search_status open", () => {
    const s = createState();
    s.recordSearchStarted({ runId: 5 });
    s.recordSearchStatus(5, { status: "processing" });
    expect(s.canGetSearchStatus()).toBe(true);
  });

  test("multiple runs: one finishing leaves the other tracked", () => {
    const s = createState();
    s.recordSearchStarted({ runId: 5 });
    s.recordSearchStarted({ runId: 6 });
    s.recordSearchStatus(5, { status: "finished" });
    expect(s.canGetSearchStatus()).toBe(true);
  });
});

test("two instances are independent", () => {
  const a = createState();
  const b = createState();
  a.recordProviderSearch({ providers: [{ source: "npi" }] });
  a.recordSearchStarted({ runId: 5 });
  expect(b.canSaveProvider()).toBe(false);
  expect(b.canGetSearchStatus()).toBe(false);
});
