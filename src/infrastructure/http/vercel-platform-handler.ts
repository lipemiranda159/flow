import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { dispatchPlatformResponse } from "../platform-response-dispatcher.js";
import { processPlatformPayload } from "../process-platform-payload.js";
import { readJsonBody } from "./read-json-body.js";
import { validateTelegramWebhook, validateWhatsAppSignature } from "./platform-webhook-security.js";
import { StructuredLogger } from "../observability/logger.js";
import { extractInboundMessageMetadata } from "../resolve-platform-request.js";

type HandlerOptions = {
  forcedChannel?: string;
  dispatchResponse?: boolean;
};

export default async function handlePlatformWebhook(
  request: VercelRequest,
  response: VercelResponse,
  options: HandlerOptions = {}
): Promise<void> {
  const startedAt = Date.now();
  const fallbackCorrelationId = getIncomingRequestId(request) ?? randomUUID();
  let logger = new StructuredLogger({ correlationId: fallbackCorrelationId });

  if (request.method === "GET" && options.forcedChannel === "whatsapp") {
    handleWhatsAppVerification(request, response);
    return;
  }

  if (request.method !== "POST") {
    logger.warn("message_validation_failed", {
      eventDetail: "method_not_allowed",
      method: request.method
    });
    response.setHeader("Allow", "POST");
    await logger.flush();
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
    return;
  }

  try {
    const { body, rawBody } = await readJsonBody(request);
    const metadata = extractInboundMessageMetadata(body);
    const correlationId = getIncomingRequestId(request) ?? metadata.messageId ?? fallbackCorrelationId;

    logger = logger.child({
      correlationId,
      messageId: metadata.messageId,
      userId: metadata.userId
    });

    logger.info("message_received", {
      channel: options.forcedChannel ?? metadata.channel,
      messageType: metadata.messageType,
      messageLength: metadata.messageLength,
      hasAttachments: metadata.hasAttachments
    });

    logger.info("message_processing_started", {
      channel: options.forcedChannel ?? metadata.channel
    });

    authorizeRequest(request, rawBody, options.forcedChannel);

    const result = await processPlatformPayload(body, options.forcedChannel, {
      correlationId,
      messageId: metadata.messageId,
      logger
    });

    if (options.dispatchResponse) {
      await dispatchPlatformResponse(result.channel, result.platformResponse, {
        correlationId,
        messageId: metadata.messageId,
        userId: metadata.userId,
        logger
      });

      logger.info("message_processing_completed", {
        channel: result.channel,
        durationMs: Date.now() - startedAt
      });

      await logger.flush();
      response.status(200).json({
        ok: true,
        dispatched: true,
        channel: result.channel,
        platformResponse: result.platformResponse
      });
      return;
    }

    logger.info("message_processing_completed", {
      channel: result.channel,
      durationMs: Date.now() - startedAt
    });

    await logger.flush();
    response.status(200).json(result.platformResponse);
  } catch (error) {
    logger.error("message_processing_failed", {
      durationMs: Date.now() - startedAt
    }, error);

    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode =
      errorMessage.includes("Platform adapter não encontrado") ||
      errorMessage.includes("Não foi possível identificar a plataforma") ||
      errorMessage.includes("Credencial inválida") ||
      errorMessage.includes("Assinatura do WhatsApp inválida") ||
      errorMessage.includes("Secret do Telegram inválido")
        ? 400
        : 500;

    await logger.flush();
    response.status(statusCode).json({
      error: { code: "PROCESSING_FAILED", message: errorMessage }
    });
  }
}

function authorizeRequest(request: VercelRequest, rawBody: string, forcedChannel: string | undefined): void {
  if (forcedChannel === "telegram") {
    if (!validateTelegramWebhook(request.headers, process.env.TELEGRAM_WEBHOOK_SECRET)) {
      throw new Error("Secret do Telegram inválido.");
    }
    return;
  }

  if (forcedChannel === "whatsapp") {
    if (!validateWhatsAppSignature(request.headers, rawBody, process.env.WHATSAPP_APP_SECRET)) {
      throw new Error("Assinatura do WhatsApp inválida.");
    }
    return;
  }

  if (process.env.API_KEY && request.headers.authorization !== `Bearer ${process.env.API_KEY}`) {
    throw new Error("Credencial inválida.");
  }
}

function handleWhatsAppVerification(request: VercelRequest, response: VercelResponse): void {
  const mode = readQueryParam(request.query["hub.mode"]);
  const token = readQueryParam(request.query["hub.verify_token"]);
  const challenge = readQueryParam(request.query["hub.challenge"]);

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    response.status(200).send(challenge ?? "");
    return;
  }

  response.status(403).json({ error: { code: "UNAUTHORIZED", message: "Token de verificação inválido." } });
}

function readQueryParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getIncomingRequestId(request: VercelRequest): string | undefined {
  const values = [
    request.headers["x-request-id"],
    request.headers["x-vercel-id"],
    request.headers["x-correlation-id"]
  ];

  for (const value of values) {
    if (Array.isArray(value) && value[0]) {
      return value[0];
    }

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}
