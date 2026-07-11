import type { Flow } from "../domain/flow.js";
import type { ConversationRepository } from "./conversation-repository.js";
import type { PlatformRequest, PlatformResponse, NormalizedActions } from "./adapters/platform-adapter.js";
import { AdapterFactory } from "./adapters/adapter-factory.js";
import { processMessage } from "../application/process-message.js";

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
  repository: ConversationRepository
): Promise<PlatformResponse> {
  // Obter o channel (pode estar no request ou como propriedade)
  const channel = (platformRequest.channel ?? "whatsapp") as string;

  // Obter adapter específico da plataforma
  const adapter = AdapterFactory.getAdapter(channel);

  // Normalizar: converter formato nativo → interno
  const normalizedMessage = adapter.normalizeRequest(platformRequest);

  // Processar usando o core (agnóstico de plataforma)
  const coreResult = await processMessage(
    {
      externalUserId: normalizedMessage.externalUserId,
      channel,
      message: normalizedMessage.message
    },
    flow,
    repository
  );

  // Preparar resultado normalizado
  const normalizedResult: NormalizedActions = {
    conversationId: coreResult.conversationId,
    status: coreResult.status,
    actions: coreResult.actions,
    executedSteps: coreResult.executedSteps
  };

  // Desnormalizar: converter formato interno → específico da plataforma
  const platformResponse = adapter.denormalizeResponse(normalizedResult);

  return platformResponse;
}
