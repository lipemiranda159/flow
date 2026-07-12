import type { ApplicationEvent } from "../domain/application-event.js";

export interface ApplicationEventRepository {
  save(event: ApplicationEvent): Promise<void>;
  list(limit?: number): Promise<ApplicationEvent[]>;
}
