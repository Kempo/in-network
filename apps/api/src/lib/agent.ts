export type Findings = {
  status: "in_network" | "out_of_network" | "inconclusive";
  provider: { name: string; npi?: string; address: string; city: string; state: string };
  scope_hint: "network_level" | "plan_specific";
};

export async function callBrowserUse(payload: { prompt: string }): Promise<Findings> {
  const res = await fetch(`${process.env.AGENT_URL}/agents/browser_use`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b) => (b as { detail?: string }).detail)
      .catch(() => undefined);
    throw new Error(`agent error ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return (await res.json()) as Findings;
}
