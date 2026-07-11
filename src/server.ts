import { createServer } from "node:http";
import { processPlatformPayload } from "./infrastructure/process-platform-payload.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");

  if (request.method === "GET" && request.url === "/health") {
    response.statusCode = 200;
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  const routeChannel = getRouteChannel(request.method, request.url);

  if (request.method !== "POST" || routeChannel === null) {
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

    const result = await processPlatformPayload(body, routeChannel ?? undefined);
    response.statusCode = 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
    const statusCode =
      errorMessage.includes("Platform adapter não encontrado") ||
      errorMessage.includes("Não foi possível identificar a plataforma")
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

function getRouteChannel(method: string | undefined, url: string | undefined): string | null {
  if (method !== "POST") {
    return null;
  }

  if (url === "/api/messages/process") {
    return "";
  }

  if (url === "/api/webhooks/telegram") {
    return "telegram";
  }

  if (url === "/api/webhooks/whatsapp") {
    return "whatsapp";
  }

  return null;
}
