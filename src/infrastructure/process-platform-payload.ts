import { exampleFlow } from "../flows/example-flow.js";
import type { PlatformRequest, PlatformResponse } from "./adapters/platform-adapter.js";
import { AdapterFactory } from "./adapters/adapter-factory.js";
import { processMessageByPlatform } from "./process-message-by-platform.js";
import { createConversationRepository } from "./repository-factory.js";
import { buildPlatformRequest } from "./resolve-platform-request.js";
import type { StructuredLogger } from "./observability/logger.js";

export type ProcessPlatformPayloadContext = {
  correlationId: string;
  messageId?: string;
  logger?: StructuredLogger;
};

export async function processPlatformPayload(
  body: Record<string, unknown>,
  forcedChannel?: string,
  context?: ProcessPlatformPayloadContext
): Promise<{ channel: string; platformRequest: PlatformRequest; platformResponse: PlatformResponse }> {
  const logger = context?.logger?.child({
    correlationId: context.correlationId,
    messageId: context.messageId,
    flowId: exampleFlow.id
  });

  let platformRequest: PlatformRequest;
  try {
    platformRequest = buildPlatformRequest(body, forcedChannel);
  } catch (error) {
    logger?.warn("message_validation_failed", {
      forcedChannel
    });
    throw error;
  }

  logger?.info("message_validation_passed", {
    channel: platformRequest.channel
  });

  AdapterFactory.getAdapter(platformRequest.channel ?? "");

  const platformResponse = await processMessageByPlatform(platformRequest, exampleFlow, createConversationRepository(), {
    correlationId: context?.correlationId ?? "unknown",
    messageId: context?.messageId,
    logger
  });

  return {
    channel: platformRequest.channel ?? "",
    platformRequest,
    platformResponse
  };
}