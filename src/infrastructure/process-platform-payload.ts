import { exampleFlow } from "../flows/example-flow.js";
import type { PlatformRequest, PlatformResponse } from "./adapters/platform-adapter.js";
import { AdapterFactory } from "./adapters/adapter-factory.js";
import { processMessageByPlatform } from "./process-message-by-platform.js";
import { createConversationRepository } from "./repository-factory.js";
import { buildPlatformRequest } from "./resolve-platform-request.js";

export async function processPlatformPayload(
  body: Record<string, unknown>,
  forcedChannel?: string
): Promise<{ channel: string; platformRequest: PlatformRequest; platformResponse: PlatformResponse }> {
  const platformRequest = buildPlatformRequest(body, forcedChannel);

  AdapterFactory.getAdapter(platformRequest.channel ?? "");

  const platformResponse = await processMessageByPlatform(platformRequest, exampleFlow, createConversationRepository());

  return {
    channel: platformRequest.channel ?? "",
    platformRequest,
    platformResponse
  };
}