import type { PlatformResponse } from "./adapters/platform-adapter.js";
import type { StructuredLogger } from "./observability/logger.js";

type TelegramResponse = {
  method?: string;
  chat_id?: number | string;
  text?: string;
  parse_mode?: string;
};

type WhatsAppResponse = {
  messaging_product?: string;
  to?: string;
  type?: string;
  text?: { body?: string };
};

type DispatchContext = {
  logger?: StructuredLogger;
  correlationId: string;
  messageId?: string;
  userId?: string;
  flowId?: string;
};

export async function dispatchPlatformResponse(
  channel: string,
  response: PlatformResponse,
  context?: DispatchContext
): Promise<void> {
  const logger = context?.logger?.child({
    correlationId: context.correlationId,
    messageId: context.messageId,
    userId: context.userId,
    flowId: context.flowId
  });

  logger?.info("response_sending", {
    channel
  });

  if (channel === "telegram") {
    await dispatchTelegramResponse(response as TelegramResponse, logger);
    logger?.info("response_sent", { channel });
    return;
  }

  if (channel === "whatsapp") {
    await dispatchWhatsAppResponse(response as WhatsAppResponse, logger);
    logger?.info("response_sent", { channel });
    return;
  }

  throw new Error(`Dispatch não suportado para channel: ${channel}`);
}

async function dispatchTelegramResponse(response: TelegramResponse, logger?: StructuredLogger): Promise<void> {
  if (!response.text) {
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  }

  if (response.chat_id === undefined || response.chat_id === null) {
    throw new Error("Telegram chat_id ausente na resposta desnormalizada.");
  }

  const startedAt = Date.now();
  logger?.info("external_request_started", {
    integrationName: "telegram_send_message",
    httpMethod: "POST"
  });

  const apiResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: response.chat_id,
      text: response.text,
      parse_mode: response.parse_mode
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`Telegram API error: ${await apiResponse.text()}`);
  }

  logger?.info("external_request_completed", {
    integrationName: "telegram_send_message",
    httpMethod: "POST",
    statusCode: apiResponse.status,
    success: apiResponse.ok,
    durationMs: Date.now() - startedAt
  });
}

async function dispatchWhatsAppResponse(response: WhatsAppResponse, logger?: StructuredLogger): Promise<void> {
  if (!response.text?.body) {
    return;
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado.");
  }

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado.");
  }

  if (!response.to) {
    throw new Error("WhatsApp destinatário ausente na resposta desnormalizada.");
  }

  const startedAt = Date.now();
  logger?.info("external_request_started", {
    integrationName: "whatsapp_send_message",
    httpMethod: "POST"
  });

  const apiResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: response.messaging_product ?? "whatsapp",
      to: response.to,
      type: response.type ?? "text",
      text: response.text
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`WhatsApp API error: ${await apiResponse.text()}`);
  }

  logger?.info("external_request_completed", {
    integrationName: "whatsapp_send_message",
    httpMethod: "POST",
    statusCode: apiResponse.status,
    success: apiResponse.ok,
    durationMs: Date.now() - startedAt
  });
}