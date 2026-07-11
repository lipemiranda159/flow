import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
