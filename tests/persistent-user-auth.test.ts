import { describe, expect, it } from "vitest";
import { processMessage } from "../src/application/process-message.js";
import type { Conversation } from "../src/domain/conversation.js";
import { flowSchema } from "../src/domain/flow.js";
import { MemoryConversationRepository } from "../src/infrastructure/memory-conversation-repository.js";

const flow = flowSchema.parse({
  id: "persistent-auth",
  name: "Persistent auth",
  version: 1,
  entryStepId: "auth-check",
  persistentVariables: ["auth"],
  variables: { auth: { token: null, userId: null }, temporary: "reset" },
  steps: [
    {
      id: "auth-check",
      type: "condition",
      expression: { operator: "is_not_empty", left: { variable: "auth.token" } },
      thenStepId: "authenticated",
      elseStepId: "login"
    },
    { id: "authenticated", type: "message", text: "Autenticado", nextStepId: "end" },
    { id: "login", type: "message", text: "Fazer login", nextStepId: "end" },
    { id: "end", type: "end" }
  ]
});

function completedConversation(user: string): Conversation {
  const now = new Date();
  return {
    id: "old-conversation", externalUserId: user, channel: "telegram",
    flowId: flow.id, flowVersion: flow.version, currentStepId: null,
    waitingInputStepId: null, status: "completed",
    variables: { auth: { token: "same-key", userId: "crm-user" }, temporary: "old" },
    version: 2, createdAt: now, updatedAt: now
  };
}

describe("persistent user authentication", () => {
  it("reaproveita auth após encerrar a conversa sem compartilhar com outro usuário", async () => {
    const repository = new MemoryConversationRepository();
    await repository.save(completedConversation("user-1"));

    const returning = await processMessage(
      { externalUserId: "user-1", channel: "telegram", message: "oi" }, flow, repository
    );
    const other = await processMessage(
      { externalUserId: "user-2", channel: "telegram", message: "oi" }, flow, repository
    );

    expect(returning.actions).toEqual([{ type: "send_message", text: "Autenticado" }]);
    expect(other.actions).toEqual([{ type: "send_message", text: "Fazer login" }]);
  });
});
