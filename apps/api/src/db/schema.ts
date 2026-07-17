import { pgTable, pgEnum, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const membershipStatus = pgEnum("membership_status", ["in_network", "out_of_network"]);

export const runStatus = pgEnum("run_status", ["pending", "processing", "finished", "failed"]);

// Generic log of an agent execution — references no domain tables. The
// run -> membership mapping lives in verification.ts, not here.
export const agentRuns = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  status: runStatus("status").notNull().default("pending"),
  prompt: text("prompt").notNull(),
  result: jsonb("result"), // agent output; null until finished
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const networks = pgTable("networks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const addresses = pgTable("addresses", {
  id: serial("id").primaryKey(),
  zip: text("zip"),
  locality: text("locality"),
  state: text("state"),
  country: text("country"),
  line1: text("line1"),
  line2: text("line2"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  networkId: integer("network_id").notNull().references(() => networks.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providers = pgTable(
  "providers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    specialty: text("specialty"),
    npi: text("npi"),
    addressId: integer("address_id").notNull().references(() => addresses.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  // one row per NPI so save_provider dedupes on re-pick; NULL npi rows (browser
  // flow) are exempt from the constraint
  (t) => [uniqueIndex("providers_npi_uniq").on(t.npi).where(sql`${t.npi} is not null`)],
);

export const providerDirectories = pgTable("provider_directories", {
  id: serial("id").primaryKey(),
  carrierId: integer("carrier_id").notNull().references(() => carriers.id),
  url: text("url").notNull(),
  instructions: text("instructions").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const networkMemberships = pgTable(
  "network_memberships",
  {
    id: serial("id").primaryKey(),
    status: membershipStatus("status").notNull(),
    planId: integer("plan_id").references(() => plans.id), // null = applies to all plans on the network
    providerId: integer("provider_id").notNull().references(() => providers.id),
    networkId: integer("network_id").notNull().references(() => networks.id),
    refreshedAt: timestamp("refreshed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // one row per (provider, network, plan); NULLS NOT DISTINCT so network-level
    // rows (plan_id = NULL) collide and upsert instead of duplicating
    unique("network_memberships_provider_network_plan_uniq")
      .on(t.providerId, t.networkId, t.planId)
      .nullsNotDistinct(),
  ],
);

export const speechRole = pgEnum("speech_role", ["user", "agent"]);

export const transcripts = pgTable("transcripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  preview: text("preview").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const speechSegments = pgTable("speech_segments", {
  id: serial("id").primaryKey(),
  transcriptId: integer("transcript_id").notNull().references(() => transcripts.id),
  text: text("text").notNull(),
  role: speechRole("role").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transcriptAnalysis = pgTable("transcript_analysis", {
  id: serial("id").primaryKey(),
  transcriptId: integer("transcript_id").notNull().references(() => transcripts.id),
  totalConversationTime: integer("total_conversation_time").notNull(),
  totalTalkingTime: integer("total_talking_time").notNull(),
  numberOfInterruptions: integer("number_of_interruptions").notNull(),
  totalSilence: integer("total_silence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const anomalyType = pgEnum("anomaly_type", ["interruption", "silence"]);

export const conversationAnomalies = pgTable("conversation_anomalies", {
  id: serial("id").primaryKey(),
  speechSegmentId: integer("speech_segment_id").notNull().references(() => speechSegments.id),
  type: anomalyType("type").notNull(),
  actionable: boolean("actionable").notNull(),
  reason: text("reason").notNull(),
  recommendation: text("recommendation"), // null when not actionable
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Carrier = typeof carriers.$inferSelect;
export type Network = typeof networks.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type ProviderDirectory = typeof providerDirectories.$inferSelect;
export type NetworkMembership = typeof networkMemberships.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type Transcript = typeof transcripts.$inferSelect;
export type SpeechSegment = typeof speechSegments.$inferSelect;
export type TranscriptAnalysis = typeof transcriptAnalysis.$inferSelect;
export type ConversationAnomaly = typeof conversationAnomalies.$inferSelect;
