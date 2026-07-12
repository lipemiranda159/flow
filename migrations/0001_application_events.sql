CREATE TABLE IF NOT EXISTS "application_events" (
  "id" uuid PRIMARY KEY,
  "level" text NOT NULL,
  "event" text NOT NULL,
  "context" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "application_events_level_check"
    CHECK ("level" IN ('info', 'warn', 'error'))
);

CREATE INDEX IF NOT EXISTS "application_events_created_at_idx"
  ON "application_events" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "application_events_event_idx"
  ON "application_events" ("event");
