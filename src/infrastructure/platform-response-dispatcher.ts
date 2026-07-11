import type { PlatformResponse } from "./adapters/platform-adapter.js";

type TelegramResponse = {
  method?: string;
  chat_id?: number | string;
  text?: string;
  parse_mode?: string;
};

type WhatsAppResponse = {
  messaging_product?: string;
  to?: string;
  type?: string;
  text?: { body?: string };
};

export async function dispatchPlatformResponse(channel: string, response: PlatformResponse): Promise<void> {
  if (channel === "telegram") {
    await dispatchTelegramResponse(response as TelegramResponse);
    return;
  }

  if (channel === "whatsapp") {
    await dispatchWhatsAppResponse(response as WhatsAppResponse);
    return;
  }

  throw new Error(`Dispatch não suportado para channel: ${channel}`);
}

async function dispatchTelegramResponse(response: TelegramResponse): Promise<void> {
  if (!response.text) {
    return;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN não configurado.");
  }

  if (response.chat_id === undefined || response.chat_id === null) {
    throw new Error("Telegram chat_id ausente na resposta desnormalizada.");
  }

  const apiResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: response.chat_id,
      text: response.text,
      parse_mode: response.parse_mode
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`Telegram API error: ${await apiResponse.text()}`);
  }
}

async function dispatchWhatsAppResponse(response: WhatsAppResponse): Promise<void> {
  if (!response.text?.body) {
    return;
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN não configurado.");
  }

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado.");
  }

  if (!response.to) {
    throw new Error("WhatsApp destinatário ausente na resposta desnormalizada.");
  }

  const apiResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: response.messaging_product ?? "whatsapp",
      to: response.to,
      type: response.type ?? "text",
      text: response.text
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`WhatsApp API error: ${await apiResponse.text()}`);
  }
}