import { describe, expect, it } from "vitest";
import type { Conversation } from "../src/domain/conversation.js";
import { executeFlow } from "../src/domain/engine.js";
import { flowSchema } from "../src/domain/flow.js";

function createFlow(availableTimes: string[]) {
  return flowSchema.parse({
    id: "availability", name: "Availability", version: 1, entryStepId: "check",
    variables: { availableTimes, date: null },
    steps: [
      {
        id: "check", type: "condition",
        expression: { operator: "is_empty", left: { variable: "availableTimes" } },
        thenStepId: "empty", elseStepId: "available"
      },
      { id: "empty", type: "message", text: "Não há horários. Escolha outra data.", nextStepId: "date" },
      { id: "date", type: "input", saveTo: "date", prompt: "Escolha a data:", nextStepId: "end" },
      { id: "available", type: "message", text: "Escolha um horário.", nextStepId: "end" },
      { id: "end", type: "end" }
    ]
  });
}

function conversation(flow: ReturnType<typeof createFlow>): Conversation {
  const now = new Date();
  return {
    id: "conversation", externalUserId: "user", channel: "telegram",
    flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
    waitingInputStepId: null, status: "active", variables: structuredClone(flow.variables),
    version: 1, createdAt: now, updatedAt: now
  };
}

describe("availability flow", () => {
  it("trata array vazio e retorna para a escolha de data", async () => {
    const flow = createFlow([]);
    const result = await executeFlow(flow, conversation(flow));
    expect(result.actions).toEqual([
      { type: "send_message", text: "Não há horários. Escolha outra data." },
      { type: "send_message", text: "Escolha a data:" }
    ]);
    expect(result.conversation.waitingInputStepId).toBe("date");
  });

  it("continua quando existem horários", async () => {
    const flow = createFlow(["2026-07-14T12:00:00Z"]);
    const result = await executeFlow(flow, conversation(flow));
    expect(result.actions).toEqual([{ type: "send_message", text: "Escolha um horário." }]);
  });
});
