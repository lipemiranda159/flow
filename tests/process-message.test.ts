import { describe, expect, it } from "vitest";
import { processMessage } from "../src/application/process-message.js";
import { exampleFlow } from "../src/flows/example-flow.js";
import { MemoryConversationRepository } from "../src/infrastructure/memory-conversation-repository.js";

describe("process message", () => {
  it("mantém a posição entre duas mensagens", async () => {
    const repository = new MemoryConversationRepository();
    const first = await processMessage({ externalUserId: "5511999", channel: "whatsapp", message: "oi" }, exampleFlow, repository);
    const second = await processMessage({ externalUserId: "5511999", channel: "whatsapp", message: "João" }, exampleFlow, repository);
    expect(first.status).toBe("waiting_input");
    expect(second.status).toBe("completed");
    expect(second.actions[0]?.text).toContain("João");
  });
});
