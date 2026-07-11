import type { Conversation } from "../domain/conversation.js";

export interface ConversationRepository {
  find(externalUserId: string, channel: string, flowId: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
