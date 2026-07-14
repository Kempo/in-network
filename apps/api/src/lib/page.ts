export function pageParams(q: Record<string, string | undefined>): { limit: number; offset: number } {
  const limit = Number(q.limit);
  const offset = Number(q.offset);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}
