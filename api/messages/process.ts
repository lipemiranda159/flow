import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { processMessageByPlatform } from "../../src/infrastructure/process-message-by-platform.js";
import { exampleFlow } from "../../src/flows/example-flow.js";
import { createConversationRepository } from "../../src/infrastructure/repository-factory.js";
import { AdapterFactory } from "../../src/infrastructure/adapters/adapter-factory.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
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
    // Detectar o channel do payload
    const body = request.body as Record<string, unknown>;
    const channel = (body.channel ?? "whatsapp") as string;

    // Validar que o adapter existe
    AdapterFactory.getAdapter(channel);

    // Processar usando o adapter específico
    const result = await processMessageByPlatform(body, exampleFlow, createConversationRepository());
    response.status(200).json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode = errorMessage.includes("Platform adapter não encontrado") ? 400 : 500;
    response.status(statusCode).json({
      error: { code: "PROCESSING_FAILED", message: errorMessage }
    });
  }
}
