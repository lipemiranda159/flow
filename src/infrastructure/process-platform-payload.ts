import { exampleFlow } from "../flows/example-flow.js";
import { AdapterFactory } from "./adapters/adapter-factory.js";
import { processMessageByPlatform } from "./process-message-by-platform.js";
import { createConversationRepository } from "./repository-factory.js";
import { buildPlatformRequest } from "./resolve-platform-request.js";

export async function processPlatformPayload(
  body: Record<string, unknown>,
  forcedChannel?: string
) {
  const platformRequest = buildPlatformRequest(body, forcedChannel);

  AdapterFactory.getAdapter(platformRequest.channel ?? "");

  return processMessageByPlatform(platformRequest, exampleFlow, createConversationRepository());
}