CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY,
  "external_user_id" text NOT NULL,
  "channel" text NOT NULL,
  "flow_id" text NOT NULL,
  "flow_version" integer NOT NULL,
  "current_step_id" text,
  "waiting_input_step_id" text,
  "status" text NOT NULL,
  "variables" jsonb NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "conversations_status_check"
    CHECK ("status" IN ('active', 'waiting_input', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversations_user_flow_unique"
  ON "conversations" ("external_user_id", "channel", "flow_id");
