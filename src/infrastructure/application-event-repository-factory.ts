import type { ApplicationEventRepository } from "../application/application-event-repository.js";
import { NeonApplicationEventRepository } from "./database/neon-application-event-repository.js";
import { MemoryApplicationEventRepository } from "./memory-application-event-repository.js";

const memoryRepository = new MemoryApplicationEventRepository();
let neonRepository: NeonApplicationEventRepository | undefined;

export function createApplicationEventRepository(): ApplicationEventRepository {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return memoryRepository;
  neonRepository ??= new NeonApplicationEventRepository(databaseUrl);
  return neonRepository;
}
