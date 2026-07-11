import { describe, expect, it } from "vitest";
import { buildPlatformRequest, detectPlatformChannel } from "../src/infrastructure/resolve-platform-request.js";

describe("platform routing", () => {
  it("detecta telegram pelo payload nativo", () => {
    const channel = detectPlatformChannel({
      update_id: 123,
      message: {
        message_id: 1,
        from: { id: 10 },
        chat: { id: 10 },
        text: "oi"
      }
    });

    expect(channel).toBe("telegram");
  });

  it("detecta whatsapp pelo payload nativo", () => {
    const channel = detectPlatformChannel({
      entry: [{ changes: [{ value: { messages: [], contacts: [] } }] }]
    });

    expect(channel).toBe("whatsapp");
  });

  it("prioriza a rota dedicada sobre o body", () => {
    const request = buildPlatformRequest({ channel: "whatsapp", update_id: 123, message: {} }, "telegram");

    expect(request.channel).toBe("telegram");
  });

  it("exige channel ou payload reconhecível na rota genérica", () => {
    expect(() => buildPlatformRequest({ externalUserId: "1", message: "oi" })).toThrow(
      "Não foi possível identificar a plataforma do webhook"
    );
  });
});