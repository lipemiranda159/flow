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
      { type: "send_message", text: "Bem-vindo ao fluxo de agendamento da UAI5 Solutions." },
      {
        type: "send_message",
        text: "Escolha uma opção:\n1 - Iniciar agendamento\n2 - Listar meus agendamentos\n3 - Consultar procedimentos"
      }
    ]);
    expect(result.conversation.waitingInputStepId).toBe("menu-input");
  });

  it("retoma a conversa e inicia autenticação quando escolhe opção 3", () => {
    const first = executeFlow(exampleFlow, conversation(), "oi");
    const second = executeFlow(exampleFlow, first.conversation, "3");
    expect(second.actions).toEqual([
      {
        type: "send_message",
        text: "Para continuar, vamos autenticar via passwordless. As chamadas seguem https://api.uai5solutions.com.br."
      },
      { type: "send_message", text: "Informe seu e-mail para solicitar o código de acesso." }
    ]);
    expect(second.conversation.status).toBe("waiting_input");
    expect(second.conversation.waitingInputStepId).toBe("auth-email");
    expect(second.conversation.variables.menuOption).toBe("3");
  });
});
