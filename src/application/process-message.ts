import { randomUUID } from "node:crypto";
import type { Conversation, OutputAction } from "../domain/conversation.js";
import { executeFlow } from "../domain/engine.js";
import type { Flow } from "../domain/flow.js";
import type { ConversationRepository } from "./conversation-repository.js";
import type { StructuredLogger } from "../infrastructure/observability/logger.js";
import { resolveValue, setPath } from "../domain/placeholders.js";

export type ProcessMessageInput = { externalUserId: string; channel: string; message?: string };
export type ProcessMessageOutput = { conversationId: string; status: string; actions: OutputAction[]; executedSteps: number };
export type ProcessMessageContext = {
  correlationId: string;
  messageId?: string;
  logger?: StructuredLogger;
};

export async function processMessage(
  input: ProcessMessageInput,
  flow: Flow,
  repository: ConversationRepository,
  context?: ProcessMessageContext
): Promise<ProcessMessageOutput> {
  const startedAt = Date.now();
  const logger = context?.logger?.child({
    correlationId: context.correlationId,
    messageId: context.messageId,
    userId: input.externalUserId,
    flowId: flow.id
  });

  logger?.info("flow_identified", { flowId: flow.id });
  logger?.info("conversation_state_loading", {
    userId: input.externalUserId,
    channel: input.channel
  });

  try {
    let conversation = await repository.find(input.externalUserId, input.channel, flow.id);
    logger?.info("conversation_state_loaded", {
      found: Boolean(conversation),
      currentStepId: conversation?.currentStepId ?? flow.entryStepId,
      status: conversation?.status
    });

    if (!conversation || ["completed", "failed"].includes(conversation.status)) {
      const now = new Date();
      const variables = structuredClone(flow.variables);
      if (conversation) {
        for (const path of flow.persistentVariables) {
          const value = resolveValue(`\${conversation.${path}}`, conversation.variables);
          if (value !== undefined && value !== null) setPath(variables, path, structuredClone(value));
        }
      }
      conversation = {
        id: randomUUID(), externalUserId: input.externalUserId, channel: input.channel,
        flowId: flow.id, flowVersion: flow.version, currentStepId: flow.entryStepId,
        waitingInputStepId: null, status: "active", variables,
        version: 1, createdAt: now, updatedAt: now
      } satisfies Conversation;
    }

    logger?.info("message_evaluation_started", {
      messageType: input.message ? "text" : "none",
      messageLength: input.message?.length ?? 0,
      hasAttachments: false,
      currentStepId: conversation.currentStepId ?? undefined
    });

    const result = await executeFlow(flow, conversation, input.message, {
      correlationId: context?.correlationId ?? "unknown",
      messageId: context?.messageId,
      userId: input.externalUserId,
      flowId: flow.id,
      logger
    });

    result.conversation.version += 1;
    logger?.info("conversation_state_saving", {
      currentStepId: result.conversation.currentStepId ?? undefined,
      status: result.conversation.status
    });

    await repository.save(result.conversation);

    logger?.info("conversation_state_saved", {
      currentStepId: result.conversation.currentStepId ?? undefined,
      status: result.conversation.status
    });

    logger?.info("message_processing_completed", {
      durationMs: Date.now() - startedAt,
      currentStepId: result.conversation.currentStepId ?? undefined,
      status: result.conversation.status,
      actionsCount: result.actions.length
    });

    return {
      conversationId: result.conversation.id,
      status: result.conversation.status,
      actions: result.actions,
      executedSteps: result.executedSteps
    };
  } catch (error) {
    logger?.error("message_processing_failed", {
      durationMs: Date.now() - startedAt,
      userId: input.externalUserId,
      flowId: flow.id
    }, error);
    throw error;
  }
}

