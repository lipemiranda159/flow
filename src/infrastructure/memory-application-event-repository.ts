import type { ApplicationEventRepository } from "../application/application-event-repository.js";
import type { ApplicationEvent } from "../domain/application-event.js";

const MAX_EVENTS = 1_000;

export class MemoryApplicationEventRepository implements ApplicationEventRepository {
  private readonly events: ApplicationEvent[] = [];

  async save(event: ApplicationEvent): Promise<void> {
    this.events.push(structuredClone(event));
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
  }

  async list(limit = 100): Promise<ApplicationEvent[]> {
    return structuredClone(this.events.slice(-Math.max(0, limit)).reverse());
  }
}
