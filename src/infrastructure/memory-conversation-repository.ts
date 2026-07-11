import type { ConversationRepository } from "../application/conversation-repository.js";
import type { Conversation } from "../domain/conversation.js";

export class MemoryConversationRepository implements ConversationRepository {
  private readonly values = new Map<string, Conversation>();
  private key(user: string, channel: string, flow: string): string { return `${channel}:${user}:${flow}`; }
  async find(user: string, channel: string, flow: string): Promise<Conversation | null> {
    return this.values.get(this.key(user, channel, flow)) ?? null;
  }
  async save(value: Conversation): Promise<void> {
    this.values.set(this.key(value.externalUserId, value.channel, value.flowId), structuredClone(value));
  }
}
