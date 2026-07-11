import { createServer } from "node:http";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "./infrastructure/http/read-json-body.js";
import { validateTelegramWebhook, validateWhatsAppSignature } from "./infrastructure/http/platform-webhook-security.js";
import { dispatchPlatformResponse } from "./infrastructure/platform-response-dispatcher.js";
import { processPlatformPayload } from "./infrastructure/process-platform-payload.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");

  if (request.method === "GET" && request.url === "/health") {
    response.statusCode = 200;
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const routeConfig = getRouteConfig(request.method, request.url);

  if (request.method === "GET" && routeConfig?.channel === "whatsapp" && routeConfig.allowVerification) {
    handleWhatsAppVerification(request, response);
    return;
  }

  if (request.method !== "POST" || routeConfig === null) {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }));
    return;
  }

  try {
    const { body, rawBody } = await readJsonBody(request);

    authorizeRequest(request.headers, rawBody, routeConfig.channel);

    const result = await processPlatformPayload(body, routeConfig.channel || undefined);

    if (routeConfig.dispatchResponse) {
      await dispatchPlatformResponse(result.channel, result.platformResponse);
      response.statusCode = 200;
      response.end(JSON.stringify({
        ok: true,
        dispatched: true,
        channel: result.channel,
        platformResponse: result.platformResponse
      }));
      return;
    }

    response.statusCode = 200;
    response.end(JSON.stringify(result.platformResponse));
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
    response.statusCode = statusCode;
    response.end(JSON.stringify({ error: {
      code: "PROCESSING_FAILED",
      message: errorMessage
    } }));
  }
});

server.listen(port, () => {
  console.log(`WhatsApp Flow local: http://localhost:${port}`);
});

function getRouteConfig(method: string | undefined, url: string | undefined): {
  channel: string;
  dispatchResponse: boolean;
  allowVerification?: boolean;
} | null {
  if (!method) {
    return null;
  }

  if (method === "POST" && url === "/api/messages/process") {
    return { channel: "", dispatchResponse: false };
  }

  if (method === "POST" && url === "/api/webhooks/telegram") {
    return { channel: "telegram", dispatchResponse: true };
  }

  if (url === "/api/webhooks/whatsapp" && (method === "POST" || method === "GET")) {
    return { channel: "whatsapp", dispatchResponse: true, allowVerification: true };
  }

  return null;
}

function authorizeRequest(headers: IncomingHttpHeaders, rawBody: string, forcedChannel: string): void {
  if (forcedChannel === "telegram") {
    if (!validateTelegramWebhook(headers, process.env.TELEGRAM_WEBHOOK_SECRET)) {
      throw new Error("Secret do Telegram inválido.");
    }
    return;
  }

  if (forcedChannel === "whatsapp") {
    if (!validateWhatsAppSignature(headers, rawBody, process.env.WHATSAPP_APP_SECRET)) {
      throw new Error("Assinatura do WhatsApp inválida.");
    }
    return;
  }

  if (process.env.API_KEY && headers.authorization !== `Bearer ${process.env.API_KEY}`) {
    throw new Error("Credencial inválida.");
  }
}

function handleWhatsAppVerification(request: IncomingMessage, response: ServerResponse): void {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const mode = requestUrl.searchParams.get("hub.mode");
  const token = requestUrl.searchParams.get("hub.verify_token");
  const challenge = requestUrl.searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    response.statusCode = 200;
    response.end(challenge);
    return;
  }

  response.statusCode = 403;
  response.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Token de verificação inválido." } }));
}
