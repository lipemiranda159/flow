import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApplicationEventRepository } from "../src/infrastructure/application-event-repository-factory.js";
import { isApplicationEventsAuthorized, parseApplicationEventsLimit } from "../src/infrastructure/http/application-events-api.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
    return;
  }

  if (!isApplicationEventsAuthorized(request.headers)) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Credencial inválida." } });
    return;
  }

  const limit = parseApplicationEventsLimit(request.query.limit);
  const events = await createApplicationEventRepository().list(limit);
  response.status(200).json({ events, count: events.length });
}
