CREATE TYPE "public"."speech_role" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TABLE "speech_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"text" text NOT NULL,
	"role" "speech_role" NOT NULL,
	"started_at" integer NOT NULL,
	"ended_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"transcript_id" integer NOT NULL,
	"total_conversation_time" integer NOT NULL,
	"total_talking_time" integer NOT NULL,
	"number_of_interruptions" integer NOT NULL,
	"total_silence" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"preview" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speech_segments" ADD CONSTRAINT "speech_segments_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_analysis" ADD CONSTRAINT "transcript_analysis_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE no action ON UPDATE no action;