import type { ConversationRepository } from "../application/conversation-repository.js";
import { NeonConversationRepository } from "./database/neon-conversation-repository.js";
import { MemoryConversationRepository } from "./memory-conversation-repository.js";

const memoryRepository = new MemoryConversationRepository();

export function createConversationRepository(): ConversationRepository {
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl ? new NeonConversationRepository(databaseUrl) : memoryRepository;
}
