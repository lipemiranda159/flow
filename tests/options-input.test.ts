import { describe, expect, it } from "vitest";
import type { Conversation } from "../src/domain/conversation.js";
import { executeFlow } from "../src/domain/engine.js";
import { flowSchema } from "../src/domain/flow.js";

const flow = flowSchema.parse({
  id: "options",
  name: "Options",
  version: 1,
  entryStepId: "business",
  variables: {
    businesses: [
      { id: "id-1", name: "Barbearia" },
      { id: "id-2", name: "Salão" }
    ],
    selectedId: null
  },
  steps: [
    {
      id: "business",
      type: "input",
      saveTo: "selectedId",
      prompt: "Escolha:",
      options: {
        source: "${conversation.businesses}",
        labelField: "name",
        valueField: "id"
      },
      nextStepId: "end"
    },
    { id: "end", type: "end" }
  ]
});

function conversation(): Conversation {
  const now = new Date();
  return {
    id: "conversation-1",
    externalUserId: "user-1",
    channel: "telegram",
    flowId: flow.id,
    flowVersion: flow.version,
    currentStepId: flow.entryStepId,
    waitingInputStepId: null,
    status: "active",
    variables: structuredClone(flow.variables),
    version: 1,
    createdAt: now,
    updatedAt: now
  };
}

describe("input options", () => {
  it("renderiza menu, rejeita número inválido e salva o valor escolhido", async () => {
    const first = await executeFlow(flow, conversation(), "oi");
    expect(first.actions).toEqual([{ type: "send_message", text: "Escolha:\n1 - Barbearia\n2 - Salão" }]);

    const invalid = await executeFlow(flow, first.conversation, "9");
    expect(invalid.conversation.waitingInputStepId).toBe("business");
    expect(invalid.conversation.variables.selectedId).toBeNull();

    const selected = await executeFlow(flow, invalid.conversation, "2");
    expect(selected.conversation.variables.selectedId).toBe("id-2");
    expect(selected.conversation.status).toBe("completed");
  });
});
