type SessionState = {
  npiCandidateSeen: boolean;
  activeRuns: Set<number>;
};

export const isTerminal = (status: string) => status === "finished" || status === "failed";

export function createState() {
  const state: SessionState = { npiCandidateSeen: false, activeRuns: new Set() };
  return {
    recordProviderSearch(res: { providers: Array<{ source: "db" | "npi" }> }) {
      for (const p of res.providers) if (p.source === "npi") state.npiCandidateSeen = true;
    },
    recordSearchStarted(res: { runId?: number }) {
      if (res.runId !== undefined) state.activeRuns.add(res.runId);
    },
    recordSearchStatus(runId: number, res: { status: string }) {
      if (isTerminal(res.status)) state.activeRuns.delete(runId);
    },
    canSaveProvider: () => state.npiCandidateSeen,
    canGetSearchStatus: () => state.activeRuns.size > 0,
  };
}
