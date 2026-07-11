import { createHmac, timingSafeEqual } from "node:crypto";

type HeaderValue = string | string[] | undefined;

export function validateTelegramWebhook(headers: Record<string, HeaderValue>, secret: string | undefined): boolean {
  if (!secret) {
    return true;
  }

  const actual = readHeader(headers, "x-telegram-bot-api-secret-token");
  return safeCompare(actual, secret);
}

export function validateWhatsAppSignature(
  headers: Record<string, HeaderValue>,
  rawBody: string,
  appSecret: string | undefined
): boolean {
  if (!appSecret) {
    return true;
  }

  const actual = readHeader(headers, "x-hub-signature-256");
  if (!actual?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeCompare(actual, expected);
}

function readHeader(headers: Record<string, HeaderValue>, name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === "string" ? value : undefined;
}

function safeCompare(left: string | undefined, right: string): boolean {
  if (!left) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}