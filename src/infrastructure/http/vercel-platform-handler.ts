import type { VercelRequest, VercelResponse } from "@vercel/node";
import { dispatchPlatformResponse } from "../platform-response-dispatcher.js";
import { processPlatformPayload } from "../process-platform-payload.js";
import { readJsonBody } from "./read-json-body.js";
import { validateTelegramWebhook, validateWhatsAppSignature } from "./platform-webhook-security.js";

type HandlerOptions = {
  forcedChannel?: string;
  dispatchResponse?: boolean;
};

export default async function handlePlatformWebhook(
  request: VercelRequest,
  response: VercelResponse,
  options: HandlerOptions = {}
): Promise<void> {
  if (request.method === "GET" && options.forcedChannel === "whatsapp") {
    handleWhatsAppVerification(request, response);
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
    return;
  }

  try {
    const { body, rawBody } = await readJsonBody(request);

    authorizeRequest(request, rawBody, options.forcedChannel);

    const result = await processPlatformPayload(body, options.forcedChannel);

    if (options.dispatchResponse) {
      await dispatchPlatformResponse(result.channel, result.platformResponse);
      response.status(200).json({
        ok: true,
        dispatched: true,
        channel: result.channel,
        platformResponse: result.platformResponse
      });
      return;
    }

    response.status(200).json(result.platformResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode =
      errorMessage.includes("Platform adapter não encontrado") ||
      errorMessage.includes("Não foi possível identificar a plataforma") ||
      errorMessage.includes("Credencial inválida") ||
      errorMessage.includes("Assinatura do WhatsApp inválida") ||
      errorMessage.includes("Secret do Telegram inválido")
        ? 400
        : 500;

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