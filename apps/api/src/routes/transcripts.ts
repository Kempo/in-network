import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { ZodError } from "zod";
import { db } from "../db/client.js";
import { transcripts, speechSegments, transcriptAnalysis, conversationAnomalies } from "../db/schema.js";
import { ingestTranscript } from "../transcripts/ingest.js";

export const transcriptsRoute = new Hono();

transcriptsRoute.post("/", async (c) => {
  const raw = await c.req.json().catch(() => null);
  try {
    const created = await ingestTranscript(raw);
    return c.json({ transcript: created }, 201);
  } catch (e) {
    if (e instanceof ZodError) return c.json({ error: "invalid segments" }, 400);
    throw e;
  }
});

transcriptsRoute.get("/", async (c) => {
  const rows = await db
    .select({
      id: transcripts.id,
      title: transcripts.title,
      preview: transcripts.preview,
      createdAt: transcripts.createdAt,
      totalConversationTime: transcriptAnalysis.totalConversationTime,
    })
    .from(transcripts)
    .leftJoin(transcriptAnalysis, eq(transcriptAnalysis.transcriptId, transcripts.id))
    .orderBy(desc(transcripts.createdAt));
  return c.json({ transcripts: rows });
});

transcriptsRoute.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const [transcript] = await db.select().from(transcripts).where(eq(transcripts.id, id)).limit(1);
  if (!transcript) return c.json({ error: "transcript not found" }, 404);
  const segments = await db
    .select()
    .from(speechSegments)
    .where(eq(speechSegments.transcriptId, id))
    .orderBy(speechSegments.startedAt);
  const [analysis] = await db
    .select()
    .from(transcriptAnalysis)
    .where(eq(transcriptAnalysis.transcriptId, id))
    .limit(1);
  const anomalies = await db
    .select({
      id: conversationAnomalies.id,
      speechSegmentId: conversationAnomalies.speechSegmentId,
      type: conversationAnomalies.type,
      actionable: conversationAnomalies.actionable,
      reason: conversationAnomalies.reason,
      recommendation: conversationAnomalies.recommendation,
    })
    .from(conversationAnomalies)
    .innerJoin(speechSegments, eq(conversationAnomalies.speechSegmentId, speechSegments.id))
    .where(eq(speechSegments.transcriptId, id))
    .orderBy(speechSegments.startedAt);
  return c.json({ transcript, segments, analysis, anomalies });
});
