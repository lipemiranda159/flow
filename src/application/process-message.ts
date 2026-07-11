import { randomUUID } from "node:crypto";
import type { Conversation, OutputAction } from "../domain/conversation.js";
import { executeFlow } from "../domain/engine.js";
import type { Flow } from "../domain/flow.js";
import type { ConversationRepository } from "./conversation-repository.js";

export type ProcessMessageInput = { externalUserId: string; channel: string; message?: string };
export type ProcessMessageOutput = { conversationId: string; status: string; actions: OutputAction[]; executedSteps: number };

export async function processMessage(
  input: ProcessMessageInput,
  flow: Flow,
  repository: ConversationRepository
): Promise<ProcessMessageOutput> {
  let conversation = await repository.find(input.externalUserId, input.channel, flow.id);
  if (!conversation || ["completed", "failed"].includes(conversation.status)) {
    const now = new Date();
    conversation = {
      id: randomUUID(), externalUserId: input.externalUserId, channel: input.channel,
      flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
      waitingInputStepId: null, status: "active", variables: structuredClone(flow.variables),
      version: 1, createdAt: now, updatedAt: now
    } satisfies Conversation;
  }
  const result = executeFlow(flow, conversation, input.message);
  result.conversation.version += 1;
  await repository.save(result.conversation);
  return {
    conversationId: result.conversation.id,
    status: result.conversation.status,
    actions: result.actions,
    executedSteps: result.executedSteps
  };
}
