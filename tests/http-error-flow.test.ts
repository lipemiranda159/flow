import { afterEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../src/domain/conversation.js";
import { executeFlow } from "../src/domain/engine.js";
import { flowSchema } from "../src/domain/flow.js";

const flow = flowSchema.parse({
  id: "http-error",
  name: "HTTP error fallback",
  version: 1,
  entryStepId: "request",
  defaultHttpErrorStepId: "error-message",
  variables: { result: null },
  steps: [
    { id: "request", type: "http_request", method: "GET", url: "https://example.invalid", saveTo: "result", nextStepId: "end" },
    { id: "error-message", type: "message", text: "Desculpe, estamos com problemas no momento. Tente novamente mais tarde.", nextStepId: "end" },
    { id: "end", type: "end" }
  ]
});

afterEach(() => vi.unstubAllGlobals());

describe("default HTTP error flow", () => {
  it("usa o fluxo padrão quando a requisição falha por erro de rede", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const now = new Date();
    const conversation: Conversation = {
      id: "conversation-1", externalUserId: "user-1", channel: "telegram",
      flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
      waitingInputStepId: null, status: "active", variables: structuredClone(flow.variables),
      version: 1, createdAt: now, updatedAt: now
    };

    const result = await executeFlow(flow, conversation);

    expect(result.actions).toEqual([{
      type: "send_message",
      text: "Desculpe, estamos com problemas no momento. Tente novamente mais tarde."
    }]);
    expect(result.conversation.variables.result).toEqual({ ok: false, status: 0, data: null });
  });
});
