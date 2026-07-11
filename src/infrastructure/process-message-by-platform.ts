import type { Flow } from "../domain/flow.js";
import type { ConversationRepository } from "../application/conversation-repository.js";
import type { PlatformRequest, PlatformResponse, NormalizedActions, NormalizedMessage } from "./adapters/platform-adapter.js";
import { AdapterFactory } from "./adapters/adapter-factory.js";
import { processMessage } from "../application/process-message.js";
import type { StructuredLogger } from "./observability/logger.js";

export type ProcessMessageByPlatformContext = {
  correlationId: string;
  messageId?: string;
  logger?: StructuredLogger;
};

/**
 * Processa mensagens de qualquer plataforma suportada
 * 
 * Fluxo:
 * 1. Pega o adapter específico baseado no channel
 * 2. Normaliza o request nativo da plataforma
 * 3. Processa a mensagem (core interno)
 * 4. Desnormaliza a resposta para formato específico da plataforma
 */
export async function processMessageByPlatform(
  platformRequest: PlatformRequest,
  flow: Flow,
  repository: ConversationRepository,
  context?: ProcessMessageByPlatformContext
): Promise<PlatformResponse> {
  const logger = context?.logger?.child({
    correlationId: context.correlationId,
    messageId: context.messageId,
    flowId: flow.id
  });

  logger?.info("message_processing_started", {
    flowId: flow.id
  });

  // Obter o channel (pode estar no request ou como propriedade)
  const channel = (platformRequest.channel ?? "whatsapp") as string;

  // Obter adapter específico da plataforma
  const adapter = AdapterFactory.getAdapter(channel);

  logger?.info("flow_identified", {
    flowId: flow.id,
    channel
  });

  // Normalizar: converter formato nativo → interno
  let normalizedMessage: NormalizedMessage;
  try {
    normalizedMessage = adapter.normalizeRequest(platformRequest);
  } catch (error) {
    logger?.warn("message_validation_failed", {
      channel,
      flowId: flow.id
    });
    throw error;
  }

  logger?.info("user_identified", {
    userId: normalizedMessage.externalUserId,
    channel,
    flowId: flow.id
  });

  // Processar usando o core (agnóstico de plataforma)
  const coreResult = await processMessage(
    {
      externalUserId: normalizedMessage.externalUserId,
      channel,
      message: normalizedMessage.message
    },
    flow,
    repository,
    {
      correlationId: context?.correlationId ?? "unknown",
      messageId: context?.messageId,
      logger
    }
  );

  // Preparar resultado normalizado
  const normalizedResult: NormalizedActions = {
    conversationId: coreResult.conversationId,
    status: coreResult.status,
    actions: coreResult.actions,
    executedSteps: coreResult.executedSteps
  };

  // Desnormalizar: converter formato interno → específico da plataforma
  const platformResponse = adapter.denormalizeResponse(normalizedResult, {
    request: platformRequest,
    normalizedMessage
  });

  logger?.info("message_processing_completed", {
    userId: normalizedMessage.externalUserId,
    flowId: flow.id,
    channel,
    status: coreResult.status,
    executedSteps: coreResult.executedSteps,
    actionsCount: coreResult.actions.length
  });

  return platformResponse;
}
