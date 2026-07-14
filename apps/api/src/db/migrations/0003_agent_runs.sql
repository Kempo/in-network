CREATE TYPE "public"."run_status" AS ENUM('pending', 'processing', 'finished', 'failed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"prompt" text NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
