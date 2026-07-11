import type { PlatformRequest } from "./adapters/platform-adapter.js";

export type InboundMessageMetadata = {
  channel?: string;
  messageId?: string;
  userId?: string;
  messageType: string;
  messageLength: number;
  hasAttachments: boolean;
};

export function detectPlatformChannel(body: Record<string, unknown>): string | undefined {
  if (typeof body.channel === "string" && body.channel.length > 0) {
    return body.channel;
  }

  if (typeof body.update_id === "number" && isRecord(body.message)) {
    return "telegram";
  }

  if (Array.isArray(body.entry)) {
    return "whatsapp";
  }

  return undefined;
}

export function buildPlatformRequest(
  body: Record<string, unknown>,
  forcedChannel?: string
): PlatformRequest {
  const channel = forcedChannel ?? detectPlatformChannel(body);

  if (!channel) {
    throw new Error("Não foi possível identificar a plataforma do webhook. Envie o campo 'channel' ou use uma rota dedicada.");
  }

  return {
    ...body,
    channel
  };
}

export function extractInboundMessageMetadata(body: Record<string, unknown>): InboundMessageMetadata {
  const detectedChannel = detectPlatformChannel(body);

  if (detectedChannel === "telegram") {
    const message = isRecord(body.message) ? body.message : undefined;
    const text = typeof message?.text === "string" ? message.text : "";
    const from = isRecord(message?.from) ? message.from : undefined;
    const hasAttachments = Boolean(message && ((message.photo as unknown[] | undefined)?.length || message.document || message.video));

    return {
      channel: "telegram",
      messageId: toOptionalString(message?.message_id ?? body.update_id),
      userId: toOptionalString(from?.id),
      messageType: typeof message?.text === "string" ? "text" : "non_text",
      messageLength: text.length,
      hasAttachments
    };
  }

  if (detectedChannel === "whatsapp") {
    const firstMessage = getWhatsAppFirstMessage(body);
    const textBody = getWhatsAppTextBody(firstMessage);

    return {
      channel: "whatsapp",
      messageId: toOptionalString(firstMessage?.id),
      userId: toOptionalString(firstMessage?.from),
      messageType: typeof firstMessage?.type === "string" ? firstMessage.type : "unknown",
      messageLength: textBody.length,
      hasAttachments: typeof firstMessage?.type === "string" && firstMessage.type !== "text"
    };
  }

  return {
    channel: detectedChannel,
    messageType: "unknown",
    messageLength: 0,
    hasAttachments: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getWhatsAppFirstMessage(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const firstEntry = entries[0];
  if (!isRecord(firstEntry)) return undefined;

  const changes = Array.isArray(firstEntry.changes) ? firstEntry.changes : [];
  const firstChange = changes[0];
  if (!isRecord(firstChange)) return undefined;

  const value = isRecord(firstChange.value) ? firstChange.value : undefined;
  const messages = Array.isArray(value?.messages) ? value.messages : [];
  const firstMessage = messages[0];

  return isRecord(firstMessage) ? firstMessage : undefined;
}

function getWhatsAppTextBody(message: Record<string, unknown> | undefined): string {
  if (!message || message.type !== "text") {
    return "";
  }

  const text = isRecord(message.text) ? message.text : undefined;
  return typeof text?.body === "string" ? text.body : "";
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}