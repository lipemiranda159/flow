import type { PlatformAdapter, PlatformRequest, PlatformResponse, NormalizedMessage, NormalizedActions } from "./platform-adapter.js";

/**
 * Adapter para WhatsApp Cloud API (Meta/Facebook)
 * Webhook real: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-example
 * 
 * Exemplo de webhook da Meta:
 * {
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "messages": [{
 *           "from": "5511999999999",
 *           "id": "wamid.xxx",
 *           "text": { "body": "Olá" }
 *         }],
 *         "contacts": [{
 *           "profile": { "name": "João" },
 *           "wa_id": "5511999999999"
 *         }]
 *       }
 *     }]
 *   }]
 * }
 */
export class WhatsAppAdapter implements PlatformAdapter {
  channel = "whatsapp";

  normalizeRequest(request: PlatformRequest): NormalizedMessage {
    // Extrair a mensagem do webhook real da Meta
    const entry = (request.entry as any[])?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
      throw new Error("WhatsApp webhook: nenhuma mensagem encontrada");
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const userId = message.from;

    if (!userId) {
      throw new Error("WhatsApp webhook: campo 'from' ausente");
    }

    // Extrair texto da mensagem
    let messageText: string | undefined;
    if (message.type === "text" && message.text?.body) {
      messageText = message.text.body;
    } else if (message.type === "interactive" && message.interactive?.button_reply?.title) {
      messageText = message.interactive.button_reply.title;
    }

    return {
      externalUserId: userId,
      message: messageText,
      metadata: {
        whatsappMessageId: message.id,
        contactName: contact?.profile?.name,
        messageType: message.type,
        timestamp: message.timestamp,
        rawWebhook: request
      }
    };
  }

  denormalizeResponse(response: NormalizedActions): PlatformResponse {
    // Resposta formatada para enviar DE VOLTA via Meta API
    // Este seria o formato para fazer um POST em: 
    // POST /v18.0/{phone_number_id}/messages
    
    return {
      // Meta espera que você faça um POST com esta estrutura
      messaging_product: "whatsapp",
      to: undefined, // seria preenchido com o phone_number do usuário
      type: "text",
      text: {
        body: this.formatActionsAsText(response.actions)
      },
      // Metadata para referência
      _internal: {
        conversationId: response.conversationId,
        status: response.status,
        actions: response.actions,
        executedSteps: response.executedSteps
      }
    };
  }

  private formatActionsAsText(actions: any[]): string {
    return actions
      .filter(a => a.type === "send_message")
      .map(a => a.text)
      .join("\n");
  }
}

