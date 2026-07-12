import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey(),
  externalUserId: text("external_user_id").notNull(),
  channel: text("channel").notNull(),
  flowId: text("flow_id").notNull(),
  flowVersion: integer("flow_version").notNull(),
  currentStepId: text("current_step_id"),
  waitingInputStepId: text("waiting_input_step_id"),
  status: text("status").notNull(),
  variables: jsonb("variables").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, table => ({
  userFlowUnique: uniqueIndex("conversations_user_flow_unique")
    .on(table.externalUserId, table.channel, table.flowId)
}));
export const applicationEvents = pgTable("application_events", {
  id: uuid("id").primaryKey(),
  level: text("level").notNull(),
  event: text("event").notNull(),
  context: jsonb("context").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, table => ({
  createdAtIndex: index("application_events_created_at_idx").on(table.createdAt),
  eventIndex: index("application_events_event_idx").on(table.event)
}));
