import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../src/domain/conversation.js";
import { executeFlow } from "../src/domain/engine.js";
import { flowSchema } from "../src/domain/flow.js";

const flow = flowSchema.parse({
  id: "date-input", name: "Date input", version: 1, entryStepId: "date",
  variables: { selectedDate: null },
  steps: [
    {
      id: "date", type: "input", saveTo: "selectedDate", prompt: "Escolha:",
      transform: { type: "date_pt_br_to_iso_utc", allowToday: true, allowTomorrow: true },
      nextStepId: "end"
    },
    { id: "end", type: "end" }
  ]
});

function conversation(): Conversation {
  const now = new Date();
  return {
    id: crypto.randomUUID(), externalUserId: "user", channel: "telegram",
    flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
    waitingInputStepId: null, status: "active", variables: structuredClone(flow.variables),
    version: 1, createdAt: now, updatedAt: now
  };
}

async function select(input: string): Promise<Conversation> {
  const first = await executeFlow(flow, conversation());
  return (await executeFlow(flow, first.conversation, input)).conversation;
}

afterEach(() => vi.useRealTimers());

describe("date input transform", () => {
  it("converte hoje e amanhã usando o calendário de São Paulo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T02:00:00Z"));
    expect((await select("hoje")).variables.selectedDate).toBe("2026-07-13T00:00:00Z");
    expect((await select("2")).variables.selectedDate).toBe("2026-07-14T00:00:00Z");
  });

  it("converte DD/MM/AAAA e rejeita datas inexistentes", async () => {
    expect((await select("14/07/2026")).variables.selectedDate).toBe("2026-07-14T00:00:00Z");
    const first = await executeFlow(flow, conversation());
    const invalid = await executeFlow(flow, first.conversation, "31/02/2026");
    expect(invalid.conversation.waitingInputStepId).toBe("date");
    expect(invalid.conversation.variables.selectedDate).toBeNull();
  });
});
