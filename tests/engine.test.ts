import { describe, expect, it } from "vitest";
import { executeFlow } from "../src/domain/engine.js";
import { exampleFlow } from "../src/flows/example-flow.js";
import type { Conversation } from "../src/domain/conversation.js";

function conversation(): Conversation {
  const now = new Date();
  return {
    id: "conversation-1", externalUserId: "user-1", channel: "whatsapp",
    flowId: exampleFlow.id, flowVersion: 1, currentStepId: exampleFlow.entryStepId,
    waitingInputStepId: null, status: "active", variables: { name: null },
    version: 1, createdAt: now, updatedAt: now
  };
}

describe("flow engine", () => {
  it("emite a pergunta e aguarda entrada", () => {
    const result = executeFlow(exampleFlow, conversation(), "oi");
    expect(result.actions).toEqual([{ type: "send_message", text: "Olá! Qual é o seu nome?" }]);
    expect(result.conversation.waitingInputStepId).toBe("name-input");
  });

  it("retoma a conversa, salva a variável e responde", () => {
    const first = executeFlow(exampleFlow, conversation(), "oi");
    const second = executeFlow(exampleFlow, first.conversation, "Maria");
    expect(second.actions).toEqual([{ type: "send_message", text: "Prazer em conhecer você, Maria!" }]);
    expect(second.conversation.status).toBe("completed");
    expect(second.conversation.variables.name).toBe("Maria");
  });
});
