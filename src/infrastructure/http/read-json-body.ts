type BodyRequest = AsyncIterable<unknown>;

export async function readJsonBody(request: BodyRequest): Promise<{ body: Record<string, unknown>; rawBody: string }> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;

    if (size > 65_536) {
      throw new Error("Payload excede 64 KB.");
    }

    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(rawBody) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Payload JSON deve ser um objeto.");
  }

  return { body: parsed, rawBody };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}