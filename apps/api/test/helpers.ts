type Seg = { role: "user" | "agent"; startedAt: number; endedAt: number };
export const seg = (role: "user" | "agent", startedAt: number, endedAt: number): Seg => ({ role, startedAt, endedAt });
