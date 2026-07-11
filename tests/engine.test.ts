import { describe, expect, it } from "vitest";
import { executeFlow } from "../src/domain/engine.js";
import { exampleFlow } from "../src/flows/example-flow.js";
import type { Conversation } from "../src/domain/conversation.js";

function conversation(): Conversation {
  const now = new Date();
  return {
    id: "conversation-1", externalUserId: "user-1", channel: "whatsapp",
    flowId: exampleFlow.id, flowVersion: 1, currentStepId: exampleFlow.entryStepId,
    waitingInputStepId: null, status: "active", variables: structuredClone(exampleFlow.variables),
    version: 1, createdAt: now, updatedAt: now
  };
}

describe("flow engine", () => {
  it("emite o menu inicial e aguarda opção", () => {
    const result = executeFlow(exampleFlow, conversation(), "oi");
    expect(result.actions).toEqual([
      { type: "send_message", text: "Bem-vindo a Barbearia Corte Fino!" },
      {
        type: "send_message",
        text: "Digite uma opção:\n1 - Agendar horário\n2 - Buscar horário marcado\n3 - Ver procedimentos"
      }
    ]);
    expect(result.conversation.waitingInputStepId).toBe("menu-input");
  });

  it("retoma a conversa e responde procedimentos quando escolhe opção 3", () => {
    const first = executeFlow(exampleFlow, conversation(), "oi");
    const second = executeFlow(exampleFlow, first.conversation, "3");
    expect(second.actions).toEqual([
      {
        type: "send_message",
        text: "Procedimentos disponíveis:\n- Corte tradicional\n- Barba completa\n- Corte + barba\n- Hidratação capilar\nSe quiser agendar, responda com 1 no menu inicial."
      },
      { type: "send_message", text: "Deseja voltar ao menu? (sim/nao)" }
    ]);
    expect(second.conversation.status).toBe("waiting_input");
    expect(second.conversation.waitingInputStepId).toBe("continue-input");
    expect(second.conversation.variables.menuOption).toBe("3");
  });
});
