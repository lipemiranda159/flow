import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchPlatformResponse } from "../src/infrastructure/platform-response-dispatcher.js";

describe("platform response dispatcher", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("envia mensagem para Telegram com o chat_id desnormalizado", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "bot-token";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await dispatchPlatformResponse("telegram", {
      method: "sendMessage",
      chat_id: 123,
      text: "Olá!",
      parse_mode: "HTML"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("envia mensagem para WhatsApp com o destinatário desnormalizado", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "meta-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-id";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    await dispatchPlatformResponse("whatsapp", {
      messaging_product: "whatsapp",
      to: "5511999999999",
      type: "text",
      text: { body: "Olá!" }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/phone-id/messages",
      expect.objectContaining({ method: "POST" })
    );
  });
});