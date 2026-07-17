CREATE TYPE "public"."anomaly_type" AS ENUM('interruption', 'silence');--> statement-breakpoint
CREATE TABLE "conversation_anomalies" (
	"id" serial PRIMARY KEY NOT NULL,
	"speech_segment_id" integer NOT NULL,
	"type" "anomaly_type" NOT NULL,
	"actionable" boolean NOT NULL,
	"reason" text NOT NULL,
	"recommendation" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_anomalies" ADD CONSTRAINT "conversation_anomalies_speech_segment_id_speech_segments_id_fk" FOREIGN KEY ("speech_segment_id") REFERENCES "public"."speech_segments"("id") ON DELETE no action ON UPDATE no action;