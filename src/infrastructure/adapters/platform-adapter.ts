import type { OutputAction } from "../../domain/conversation.js";

/**
 * Entrada específica da plataforma (formato nativo de cada provedor)
 * Ex: Webhook do WhatsApp, payload do Telegram, etc.
 */
export interface PlatformRequest {
  readonly channel?: string;
  readonly [key: string]: unknown;
}

/**
 * Resposta específica da plataforma (formato nativo)
 * Ex: Resposta JSON do WhatsApp, resposta Telegram, etc.
 */
export interface PlatformResponse {
  readonly [key: string]: unknown;
}

/**
 * Formato interno normalizado (independente de plataforma)
 */
export interface NormalizedMessage {
  readonly externalUserId: string;
  readonly message?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface NormalizedActions {
  readonly conversationId: string;
  readonly status: string;
  readonly actions: OutputAction[];
  readonly executedSteps: number;
}

export interface DenormalizeContext {
  readonly request: PlatformRequest;
  readonly normalizedMessage: NormalizedMessage;
}

/**
 * Adapter para conversão bidirecional entre formato da plataforma e interno
 */
export interface PlatformAdapter {
  /**
   * Plataforma que este adapter manipula
   */
  channel: string;

  /**
   * Converte request nativo da plataforma para formato interno
   */
  normalizeRequest(request: PlatformRequest): NormalizedMessage;

  /**
   * Converte resposta interna para formato específico da plataforma
   */
  denormalizeResponse(response: NormalizedActions, context: DenormalizeContext): PlatformResponse;
}
