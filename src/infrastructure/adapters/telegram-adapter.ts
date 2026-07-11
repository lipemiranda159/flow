import type { PlatformAdapter, PlatformRequest, PlatformResponse, NormalizedMessage, NormalizedActions, DenormalizeContext } from "./platform-adapter.js";

/**
 * Adapter para Telegram Bot API
 * Webhook real: https://core.telegram.org/bots/api#update
 * 
 * Exemplo de update do Telegram:
 * {
 *   "update_id": 123456789,
 *   "message": {
 *     "message_id": 1,
 *     "from": {
 *       "id": 111222333,
 *       "is_bot": false,
 *       "first_name": "João",
 *       "username": "joao_silva"
 *     },
 *     "chat": {
 *       "id": 111222333,
 *       "first_name": "João",
 *       "username": "joao_silva",
 *       "type": "private"
 *     },
 *     "date": 1720710633,
 *     "text": "Olá"
 *   }
 * }
 */
export class TelegramAdapter implements PlatformAdapter {
  channel = "telegram";

  normalizeRequest(request: PlatformRequest): NormalizedMessage {
    // Validar estrutura de update do Telegram
    if (!("message" in request) || typeof request.message !== "object" || request.message === null) {
      throw new Error("Telegram update deve conter field 'message'");
    }

    const message = request.message as Record<string, unknown>;
    if (!("from" in message) || typeof message.from !== "object" || message.from === null) {
      throw new Error("Telegram message deve conter field 'from'");
    }

    const from = message.from as Record<string, unknown>;
    if (typeof from.id !== "number") {
      throw new Error("Telegram user id deve ser número");
    }

    const chat = message.chat as Record<string, unknown>;

    return {
      externalUserId: String(from.id), // Converter para string
      message: typeof message.text === "string" ? message.text : undefined,
      metadata: {
        telegramUpdateId: request.update_id,
        telegramMessageId: message.message_id,
        telegramChatId: chat?.id,
        userName: from.first_name,
        userUsername: from.username,
        timestamp: message.date,
        rawUpdate: request
      }
    };
  }

  denormalizeResponse(response: NormalizedActions, context: DenormalizeContext): PlatformResponse {
    // Resposta formatada para enviar DE VOLTA via Telegram Bot API
    // O seu bot faria um POST para:
    // POST https://api.telegram.org/bot{BOT_TOKEN}/sendMessage
    
    const messageTexts = response.actions
      .filter(a => a.type === "send_message")
      .map(a => a.text);

    return {
      // Estrutura esperada pela Telegram Bot API
      method: "sendMessage",
      chat_id: context.normalizedMessage.metadata?.telegramChatId,
      text: messageTexts.join("\n"),
      parse_mode: "HTML", // Telegram suporta HTML/Markdown
      
      // Metadata interna para referência
      _internal: {
        conversationId: response.conversationId,
        status: response.status,
        actions: response.actions,
        executedSteps: response.executedSteps,
        metadata: context.normalizedMessage.metadata,
        allActions: response.actions // Pode ter mais tipos de ações
      }
    };
  }
}

