import { describe, expect, it } from "vitest";
import type { Conversation } from "../src/domain/conversation.js";
import { executeFlow } from "../src/domain/engine.js";
import { flowSchema } from "../src/domain/flow.js";

const flow = flowSchema.parse({
  id: "time-options", name: "Time options", version: 1, entryStepId: "time",
  variables: { times: ["2026-07-14T12:00:00Z", "2026-07-14T12:40:00Z"], selected: null, selectedLabel: null },
  steps: [
    {
      id: "time", type: "input", saveTo: "selected", prompt: "Escolha:",
      options: { source: "${conversation.times}", labelFormat: "datetime_pt_br", saveLabelTo: "selectedLabel" },
      nextStepId: "end"
    },
    { id: "end", type: "end" }
  ]
});

function conversation(): Conversation {
  const now = new Date();
  return {
    id: "conversation", externalUserId: "user", channel: "telegram",
    flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
    waitingInputStepId: null, status: "active", variables: structuredClone(flow.variables),
    version: 1, createdAt: now, updatedAt: now
  };
}

describe("time options", () => {
  it("mostra horário local e salva o ISO original", async () => {
    const first = await executeFlow(flow, conversation());
    expect(first.actions[0]?.text).toContain("1 - 14/07/2026, 09:00");
    expect(first.actions[0]?.text).toContain("2 - 14/07/2026, 09:40");

    const selected = await executeFlow(flow, first.conversation, "2");
    expect(selected.conversation.variables.selected).toBe("2026-07-14T12:40:00Z");
    expect(selected.conversation.variables.selectedLabel).toBe("14/07/2026, 09:40");
  });
});

