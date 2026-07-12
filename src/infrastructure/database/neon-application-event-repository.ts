import { neon } from "@neondatabase/serverless";
import { desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { ApplicationEventRepository } from "../../application/application-event-repository.js";
import type { ApplicationEvent } from "../../domain/application-event.js";
import { applicationEvents } from "./schema.js";

export class NeonApplicationEventRepository implements ApplicationEventRepository {
  private readonly db;

  constructor(databaseUrl: string) {
    this.db = drizzle(neon(databaseUrl));
  }

  async save(event: ApplicationEvent): Promise<void> {
    await this.db.insert(applicationEvents).values(event);
  }

  async list(limit = 100): Promise<ApplicationEvent[]> {
    const rows = await this.db.select().from(applicationEvents)
      .orderBy(desc(applicationEvents.createdAt)).limit(Math.max(0, limit));
    return rows.map(row => ({ ...row, level: row.level as ApplicationEvent["level"], context: row.context as Record<string, unknown> }));
  }
}

