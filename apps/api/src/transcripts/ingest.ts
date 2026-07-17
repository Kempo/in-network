import { db } from "../db/client.js";
import { transcripts, speechSegments, transcriptAnalysis, conversationAnomalies } from "../db/schema.js";
import { parseSegments, previewFrom } from "./parse.js";
import { computeAnalysis } from "./analysis.js";
import { detectAnomalyCandidates } from "./anomaly.js";
import { generateTitle } from "./title.js";
import { classifyAnomalies } from "./classify.js";

export async function ingestTranscript(raw: unknown) {
  const parsed = parseSegments(raw);
  const metrics = computeAnalysis(parsed);
  const title = await generateTitle(parsed);
  const preview = previewFrom(parsed);
  const candidates = detectAnomalyCandidates(parsed);
  const classified = await classifyAnomalies(title, parsed, candidates);

  return db.transaction(async (tx) => {
    const [t] = await tx.insert(transcripts).values({ title, preview }).returning();
    const inserted =
      parsed.length > 0
        ? await tx.insert(speechSegments).values(parsed.map((s) => ({ ...s, transcriptId: t.id }))).returning()
        : [];
    if (candidates.length > 0) {
      await tx.insert(conversationAnomalies).values(
        candidates.map((cand, i) => ({
          speechSegmentId: inserted[cand.segmentIndex].id,
          type: cand.type,
          actionable: classified[i].actionable,
          reason: classified[i].reason,
          recommendation: classified[i].recommendation,
        })),
      );
    }
    await tx.insert(transcriptAnalysis).values({ transcriptId: t.id, ...metrics });
    return t;
  });
}
