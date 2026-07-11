import type { PlatformRequest } from "./adapters/platform-adapter.js";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}