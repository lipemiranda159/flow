import type { VercelRequest, VercelResponse } from "@vercel/node";
import handlePlatformWebhook from "../../src/infrastructure/http/vercel-platform-handler.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await handlePlatformWebhook(request, response, { forcedChannel: "whatsapp" });
}