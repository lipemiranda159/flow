import type { Conversation, OutputAction } from "./conversation.js";
import type { Expression, Flow } from "./flow.js";
import { renderTemplate, resolveValue, setPath } from "./placeholders.js";
import type { StructuredLogger } from "../infrastructure/observability/logger.js";

export type ExecutionResult = { conversation: Conversation; actions: OutputAction[]; executedSteps: number };
export type ExecutionContext = {
  correlationId: string;
  messageId?: string;
  userId?: string;
  flowId?: string;
  logger?: StructuredLogger;
};

function evaluate(expression: Expression, variables: Record<string, unknown>): boolean {
  const left = "variable" in expression.left
    ? resolveValue(`\${conversation.${expression.left.variable}}`, variables)
    : expression.left.value;
  const right = expression.right
    ? ("variable" in expression.right
      ? resolveValue(`\${conversation.${expression.right.variable}}`, variables)
      : expression.right.value)
    : undefined;
  if (expression.operator === "equals") return left === right;
  if (expression.operator === "not_equals") return left !== right;
  if (expression.operator === "is_empty") return left === null || left === undefined || left === "";
  return left !== null && left !== undefined && left !== "";
}

export async function executeFlow(
  flow: Flow,
  original: Conversation,
  incomingMessage?: string,
  context?: ExecutionContext
): Promise<ExecutionResult> {
  const conversation: Conversation = { ...original, variables: structuredClone(original.variables) };
  const actions: OutputAction[] = [];
  const steps = new Map(flow.steps.map(step => [step.id, step]));
  let executedSteps = 0;
  const logger = context?.logger?.child({
    correlationId: context.correlationId,
    messageId: context.messageId,
    userId: context.userId,
    flowId: context.flowId ?? flow.id
  });

  if (conversation.waitingInputStepId) {
    if (incomingMessage === undefined || incomingMessage.trim() === "") {
      return { conversation, actions, executedSteps };
    }
    const waiting = steps.get(conversation.waitingInputStepId);
    if (!waiting || waiting.type !== "input") throw new Error("Estado de input inválido");
    logger?.info("flow_step_started", {
      currentStepId: waiting.id,
      stepType: "input"
    });
    setPath(conversation.variables, waiting.saveTo, incomingMessage.trim());
    logger?.info("flow_step_completed", {
      currentStepId: waiting.id,
      nextStepId: waiting.nextStepId,
      stepType: "input"
    });
    conversation.waitingInputStepId = null;
    conversation.status = "active";
    conversation.currentStepId = waiting.nextStepId;
  }

  while (conversation.currentStepId) {
    if (++executedSteps > 100) throw new Error("Limite de steps excedido");
    const step = steps.get(conversation.currentStepId);
    if (!step) throw new Error(`Step não encontrado: ${conversation.currentStepId}`);

    logger?.info("flow_step_started", {
      currentStepId: step.id,
      stepType: step.type
    });

    if (step.type === "message") {
      const rendered = renderTemplate(step.text, conversation.variables);
      logger?.info("variables_resolved", {
        currentStepId: step.id,
        templateLength: step.text.length,
        renderedLength: rendered.length
      });
      actions.push({ type: "send_message", text: rendered });
      conversation.currentStepId = step.nextStepId;
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: step.nextStepId,
        stepType: step.type
      });
    } else if (step.type === "input") {
      if (step.prompt) {
        const renderedPrompt = renderTemplate(step.prompt, conversation.variables);
        logger?.info("variables_resolved", {
          currentStepId: step.id,
          templateLength: step.prompt.length,
          renderedLength: renderedPrompt.length
        });
        actions.push({ type: "send_message", text: renderedPrompt });
      }
      conversation.waitingInputStepId = step.id;
      conversation.status = "waiting_input";
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: step.id,
        stepType: step.type
      });
      break;
    } else if (step.type === "set_variable") {
      setPath(conversation.variables, step.variable, resolveValue(step.value, conversation.variables));
      conversation.currentStepId = step.nextStepId;
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: step.nextStepId,
        stepType: step.type,
        variable: step.variable
      });
    } else if (step.type === "http_request") {
      const requestStartedAt = Date.now();
      const resolvedHeaders = Object.fromEntries(
        Object.entries(step.headers).map(([key, value]) => [key, renderTemplate(value, conversation.variables)])
      );
      const resolvedUrl = renderTemplate(step.url, conversation.variables);
      const resolvedBody = step.body === undefined ? undefined : resolveData(step.body, conversation.variables);

      logger?.info("external_request_started", {
        currentStepId: step.id,
        integrationName: deriveIntegrationName(resolvedUrl),
        httpMethod: step.method
      });

      const response = await fetch(resolvedUrl, {
        method: step.method,
        headers: resolvedHeaders,
        body: resolvedBody === undefined ? undefined : JSON.stringify(resolvedBody)
      });

      const responseData = await parseResponseBody(response);
      setPath(conversation.variables, step.saveTo, {
        ok: response.ok,
        status: response.status,
        data: responseData
      });

      logger?.info("external_request_completed", {
        currentStepId: step.id,
        integrationName: deriveIntegrationName(resolvedUrl),
        httpMethod: step.method,
        statusCode: response.status,
        success: response.ok,
        durationMs: Date.now() - requestStartedAt
      });

      if (!response.ok) {
        if (step.onErrorStepId) {
          logger?.warn("flow_step_completed", {
            currentStepId: step.id,
            nextStepId: step.onErrorStepId,
            stepType: step.type
          });
          conversation.currentStepId = step.onErrorStepId;
        } else {
          throw new Error(`HTTP ${step.method} ${resolvedUrl} falhou com status ${response.status}`);
        }
      } else {
        conversation.currentStepId = step.nextStepId;
        logger?.info("flow_step_completed", {
          currentStepId: step.id,
          nextStepId: step.nextStepId,
          stepType: step.type
        });
      }
    } else if (step.type === "condition") {
      conversation.currentStepId = evaluate(step.expression, conversation.variables) ? step.thenStepId : step.elseStepId;
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: conversation.currentStepId,
        stepType: step.type
      });
    } else if (step.type === "switch") {
      const value = "variable" in step.expression
        ? resolveValue(`\${conversation.${step.expression.variable}}`, conversation.variables)
        : step.expression.value;
      conversation.currentStepId = step.cases.find(item => item.equals === value)?.nextStepId ?? step.defaultStepId;
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: conversation.currentStepId,
        stepType: step.type
      });
    } else if (step.type === "goto") {
      conversation.currentStepId = step.targetStepId;
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: conversation.currentStepId,
        stepType: step.type
      });
    } else {
      conversation.currentStepId = null;
      conversation.waitingInputStepId = null;
      conversation.status = "completed";
      logger?.info("flow_step_completed", {
        currentStepId: step.id,
        nextStepId: "completed",
        stepType: step.type
      });
    }
  }
  conversation.updatedAt = new Date();
  return { conversation, actions, executedSteps };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function resolveData(value: unknown, variables: Record<string, unknown>): unknown {
  if (Array.isArray(value)) {
    return value.map(item => resolveData(item, variables));
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, resolveData(item, variables)]);
    return Object.fromEntries(entries);
  }

  if (typeof value === "string") {
    return resolveValue(value, variables);
  }

  return value;
}

function deriveIntegrationName(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return rawUrl;
  }
}
