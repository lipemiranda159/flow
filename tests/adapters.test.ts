import { describe, it, expect, beforeEach } from "vitest";
import { WhatsAppAdapter } from "../src/infrastructure/adapters/whatsapp-adapter.js";
import { TelegramAdapter } from "../src/infrastructure/adapters/telegram-adapter.js";
import { AdapterFactory } from "../src/infrastructure/adapters/adapter-factory.js";
import type { PlatformRequest, NormalizedActions } from "../src/infrastructure/adapters/platform-adapter.js";

describe("Platform Adapters", () => {
  describe("WhatsApp Adapter", () => {
    let adapter: WhatsAppAdapter;

    beforeEach(() => {
      adapter = new WhatsAppAdapter();
    });

    it("deve normalizar webhook REAL da Meta corretamente", () => {
      const request: PlatformRequest = {
        channel: "whatsapp",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "5511999999999",
                      id: "wamid.xxx",
                      type: "text",
                      text: { body: "Olá" },
                      timestamp: "1720710633"
                    }
                  ],
                  contacts: [
                    {
                      profile: { name: "João" },
                      wa_id: "5511999999999"
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const normalized = adapter.normalizeRequest(request);

      expect(normalized.externalUserId).toBe("5511999999999");
      expect(normalized.message).toBe("Olá");
      expect(normalized.metadata?.whatsappMessageId).toBe("wamid.xxx");
      expect(normalized.metadata?.contactName).toBe("João");
    });

    it("deve rejeitar webhook sem messages", () => {
      const request: PlatformRequest = {
        channel: "whatsapp",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [],
                  contacts: []
                }
              }
            ]
          }
        ]
      };

      expect(() => adapter.normalizeRequest(request)).toThrow(
        "WhatsApp webhook: nenhuma mensagem encontrada"
      );
    });

    it("deve desnormalizar response para formato Meta API", () => {
      const request: PlatformRequest = {
        channel: "whatsapp",
        entry: []
      };
      const response: NormalizedActions = {
        conversationId: "conv-123",
        status: "active",
        actions: [
          { type: "send_message", text: "Olá!" },
          { type: "send_message", text: "Como posso ajudar?" }
        ],
        executedSteps: 2
      };

      const platformResponse = adapter.denormalizeResponse(response, {
        request,
        normalizedMessage: {
          externalUserId: "5511999999999",
          message: "Olá",
          metadata: { contactName: "João" }
        }
      });
      const whatsappResponse = platformResponse as {
        messaging_product?: string;
        to?: string;
        type?: string;
        text?: { body?: string };
        _internal?: { conversationId?: string };
      };

      expect(whatsappResponse.messaging_product).toBe("whatsapp");
      expect(whatsappResponse.to).toBe("5511999999999");
      expect(whatsappResponse.type).toBe("text");
      expect(whatsappResponse.text?.body).toContain("Olá!");
      expect(whatsappResponse._internal?.conversationId).toBe("conv-123");
    });
  });

  describe("Telegram Adapter", () => {
    let adapter: TelegramAdapter;

    beforeEach(() => {
      adapter = new TelegramAdapter();
    });

    it("deve normalizar update REAL do Telegram corretamente", () => {
      const request: PlatformRequest = {
        channel: "telegram",
        update_id: 123456789,
        message: {
          message_id: 42,
          from: {
            id: 111222333,
            is_bot: false,
            first_name: "João",
            username: "joao_silva"
          },
          chat: {
            id: 111222333,
            first_name: "João",
            type: "private"
          },
          date: 1720710633,
          text: "Olá"
        }
      };

      const normalized = adapter.normalizeRequest(request);

      expect(normalized.externalUserId).toBe("111222333");
      expect(normalized.message).toBe("Olá");
      expect(normalized.metadata?.telegramChatId).toBe(111222333);
      expect(normalized.metadata?.userName).toBe("João");
      expect(normalized.metadata?.userUsername).toBe("joao_silva");
    });

    it("deve rejeitar update sem message", () => {
      const request: PlatformRequest = {
        channel: "telegram",
        update_id: 123456789
      };

      expect(() => adapter.normalizeRequest(request)).toThrow(
        "Telegram update deve conter field 'message'"
      );
    });

    it("deve rejeitar message sem from", () => {
      const request: PlatformRequest = {
        channel: "telegram",
        update_id: 123456789,
        message: {
          message_id: 1,
          text: "Olá"
        }
      };

      expect(() => adapter.normalizeRequest(request)).toThrow(
        "Telegram message deve conter field 'from'"
      );
    });

    it("deve desnormalizar response para formato Telegram Bot API", () => {
      const request: PlatformRequest = {
        channel: "telegram",
        update_id: 123456789,
        message: {
          message_id: 42,
          from: { id: 111222333 },
          chat: { id: 111222333 },
          text: "Olá"
        }
      };
      const response: NormalizedActions = {
        conversationId: "conv-123",
        status: "active",
        actions: [
          { type: "send_message", text: "Olá!" }
        ],
        executedSteps: 1
      };

      const platformResponse = adapter.denormalizeResponse(response, {
        request,
        normalizedMessage: {
          externalUserId: "111222333",
          message: "Olá",
          metadata: { telegramChatId: 111222333 }
        }
      });
      const telegramResponse = platformResponse as {
        method?: string;
        chat_id?: number;
        text?: string;
        parse_mode?: string;
        _internal?: { conversationId?: string };
      };

      expect(telegramResponse.method).toBe("sendMessage");
      expect(telegramResponse.chat_id).toBe(111222333);
      expect(telegramResponse.text).toBe("Olá!");
      expect(telegramResponse.parse_mode).toBe("HTML");
      expect(telegramResponse._internal?.conversationId).toBe("conv-123");
    });
  });

  describe("Adapter Factory", () => {
    it("deve retornar adapter correto para WhatsApp", () => {
      const adapter = AdapterFactory.getAdapter("whatsapp");
      expect(adapter.channel).toBe("whatsapp");
    });

    it("deve retornar adapter correto para Telegram", () => {
      const adapter = AdapterFactory.getAdapter("telegram");
      expect(adapter.channel).toBe("telegram");
    });

    it("deve ser case-insensitive", () => {
      const adapter1 = AdapterFactory.getAdapter("WhatsApp");
      const adapter2 = AdapterFactory.getAdapter("WHATSAPP");
      expect(adapter1.channel).toBe("whatsapp");
      expect(adapter2.channel).toBe("whatsapp");
    });

    it("deve lançar erro para platform desconhecida", () => {
      expect(() => AdapterFactory.getAdapter("signal")).toThrow(
        "Platform adapter não encontrado para channel: signal"
      );
    });

    it("deve listar channels suportados", () => {
      const channels = AdapterFactory.getSupportedChannels();
      expect(channels).toContain("whatsapp");
      expect(channels).toContain("telegram");
    });
  });
});
