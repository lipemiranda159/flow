import { createServer } from "node:http";
import { processMessageByPlatform } from "./infrastructure/process-message-by-platform.js";
import { exampleFlow } from "./flows/example-flow.js";
import { createConversationRepository } from "./infrastructure/repository-factory.js";
import { AdapterFactory } from "./infrastructure/adapters/adapter-factory.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");

  if (request.method === "GET" && request.url === "/health") {
    response.statusCode = 200;
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/api/messages/process") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }));
    return;
  }

  if (process.env.API_KEY && request.headers.authorization !== `Bearer ${process.env.API_KEY}`) {
    response.statusCode = 401;
    response.end(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Credencial inválida." } }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 65_536) throw new Error("Payload excede 64 KB.");
      chunks.push(buffer);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    
    // Detectar o channel
    const channel = (body.channel ?? "whatsapp") as string;
    
    // Validar que o adapter existe
    AdapterFactory.getAdapter(channel);
    
    // Processar usando o adapter específico
    const result = await processMessageByPlatform(body, exampleFlow, createConversationRepository());
    response.statusCode = 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode = errorMessage.includes("Platform adapter não encontrado") ? 400 : 500;
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
