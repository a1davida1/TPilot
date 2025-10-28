-- Create schedule_jobs table to orchestrate scheduled posting with retry tracking
CREATE TABLE "schedule_jobs" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scheduled_post_id" integer REFERENCES "scheduled_posts"("id") ON DELETE SET NULL,
  "job_type" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "priority" integer NOT NULL DEFAULT 0,
  "run_at" timestamptz NOT NULL,
  "locked_at" timestamptz,
  "locked_by" varchar(100),
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "retry_backoff_seconds" integer NOT NULL DEFAULT 60,
  "retry_at" timestamptz,
  "last_error" text,
  "last_run_at" timestamptz,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_jobs_status_check CHECK ("status" IN ('pending','queued','running','succeeded','failed','cancelled'))
);
--> statement-breakpoint

CREATE INDEX "schedule_jobs_user_run_idx" ON "schedule_jobs" ("user_id", "run_at");
--> statement-breakpoint
CREATE INDEX "schedule_jobs_status_idx" ON "schedule_jobs" ("status");
--> statement-breakpoint
CREATE INDEX "schedule_jobs_retry_idx" ON "schedule_jobs" ("retry_at");
--> statement-breakpoint
CREATE INDEX "schedule_jobs_scheduled_post_idx" ON "schedule_jobs" ("scheduled_post_id");
--> statement-breakpoint

COMMENT ON TABLE "schedule_jobs" IS 'Queue of scheduled posting jobs with retry metadata and execution tracking.';
--> statement-breakpoint
COMMENT ON COLUMN "schedule_jobs"."payload" IS 'Sanitised job payload required to process the scheduled post.';
--> statement-breakpoint

CREATE TABLE "schedule_job_attempts" (
  "id" serial PRIMARY KEY,
  "job_id" integer NOT NULL REFERENCES "schedule_jobs"("id") ON DELETE CASCADE,
  "attempt_number" integer NOT NULL,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "finished_at" timestamptz,
  "error" text,
  "result" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX "schedule_job_attempts_job_attempt_idx" ON "schedule_job_attempts" ("job_id", "attempt_number");
--> statement-breakpoint

COMMENT ON TABLE "schedule_job_attempts" IS 'Audit trail of schedule job executions for observability and retry analysis.';
--> statement-breakpoint
COMMENT ON COLUMN "schedule_job_attempts"."result" IS 'Optional execution result payload captured when a job succeeds.';
--> statement-breakpoint
