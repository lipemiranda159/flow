import type { VercelRequest, VercelResponse } from "@vercel/node";
import { processPlatformPayload } from "../process-platform-payload.js";

type HandlerOptions = {
  forcedChannel?: string;
};

export default async function handlePlatformWebhook(
  request: VercelRequest,
  response: VercelResponse,
  options: HandlerOptions = {}
): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
    return;
  }

  if (process.env.API_KEY && request.headers.authorization !== `Bearer ${process.env.API_KEY}`) {
    response.status(401).json({ error: { code: "UNAUTHORIZED", message: "Credencial inválida." } });
    return;
  }

  try {
    const body = request.body as Record<string, unknown>;
    const result = await processPlatformPayload(body, options.forcedChannel);
    response.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode =
      errorMessage.includes("Platform adapter não encontrado") ||
      errorMessage.includes("Não foi possível identificar a plataforma")
        ? 400
        : 500;

    response.status(statusCode).json({
      error: { code: "PROCESSING_FAILED", message: errorMessage }
    });
  }
}