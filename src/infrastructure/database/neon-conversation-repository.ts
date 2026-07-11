import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { ConversationRepository } from "../../application/conversation-repository.js";
import type { Conversation } from "../../domain/conversation.js";
import { conversations } from "./schema.js";

export class NeonConversationRepository implements ConversationRepository {
  private readonly db;

  constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl));
  }

  async find(externalUserId: string, channel: string, flowId: string): Promise<Conversation | null> {
    const rows = await this.db.select().from(conversations).where(and(
      eq(conversations.externalUserId, externalUserId),
      eq(conversations.channel, channel),
      eq(conversations.flowId, flowId)
    )).limit(1);
    const row = rows[0];
    if (!row) return null;
    return { ...row, status: row.status as Conversation["status"], variables: row.variables as Record<string, unknown> };
  }

  async save(value: Conversation): Promise<void> {
    await this.db.insert(conversations).values(value).onConflictDoUpdate({
      target: [conversations.externalUserId, conversations.channel, conversations.flowId],
      set: {
        currentStepId: value.currentStepId,
        waitingInputStepId: value.waitingInputStepId,
        status: value.status,
        variables: value.variables,
        version: value.version,
        updatedAt: value.updatedAt
      }
    });
  }
}
