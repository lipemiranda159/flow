import type { Conversation, OutputAction } from "./conversation.js";
import type { Expression, Flow } from "./flow.js";
import { renderTemplate, resolveValue, setPath } from "./placeholders.js";

export type ExecutionResult = { conversation: Conversation; actions: OutputAction[]; executedSteps: number };

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

export async function executeFlow(flow: Flow, original: Conversation, incomingMessage?: string): Promise<ExecutionResult> {
  const conversation: Conversation = { ...original, variables: structuredClone(original.variables) };
  const actions: OutputAction[] = [];
  const steps = new Map(flow.steps.map(step => [step.id, step]));
  let executedSteps = 0;

  if (conversation.waitingInputStepId) {
    if (incomingMessage === undefined || incomingMessage.trim() === "") {
      return { conversation, actions, executedSteps };
    }
    const waiting = steps.get(conversation.waitingInputStepId);
    if (!waiting || waiting.type !== "input") throw new Error("Estado de input inválido");
    setPath(conversation.variables, waiting.saveTo, incomingMessage.trim());
    conversation.waitingInputStepId = null;
    conversation.status = "active";
    conversation.currentStepId = waiting.nextStepId;
  }

  while (conversation.currentStepId) {
    if (++executedSteps > 100) throw new Error("Limite de steps excedido");
    const step = steps.get(conversation.currentStepId);
    if (!step) throw new Error(`Step não encontrado: ${conversation.currentStepId}`);

    if (step.type === "message") {
      actions.push({ type: "send_message", text: renderTemplate(step.text, conversation.variables) });
      conversation.currentStepId = step.nextStepId;
    } else if (step.type === "input") {
      if (step.prompt) actions.push({ type: "send_message", text: renderTemplate(step.prompt, conversation.variables) });
      conversation.waitingInputStepId = step.id;
      conversation.status = "waiting_input";
      break;
    } else if (step.type === "set_variable") {
      setPath(conversation.variables, step.variable, resolveValue(step.value, conversation.variables));
      conversation.currentStepId = step.nextStepId;
    } else if (step.type === "http_request") {
      const resolvedHeaders = Object.fromEntries(
        Object.entries(step.headers).map(([key, value]) => [key, renderTemplate(value, conversation.variables)])
      );
      const resolvedUrl = renderTemplate(step.url, conversation.variables);
      const resolvedBody = step.body === undefined ? undefined : resolveData(step.body, conversation.variables);

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

      if (!response.ok) {
        if (step.onErrorStepId) {
          conversation.currentStepId = step.onErrorStepId;
        } else {
          throw new Error(`HTTP ${step.method} ${resolvedUrl} falhou com status ${response.status}`);
        }
      } else {
        conversation.currentStepId = step.nextStepId;
      }
    } else if (step.type === "condition") {
      conversation.currentStepId = evaluate(step.expression, conversation.variables) ? step.thenStepId : step.elseStepId;
    } else if (step.type === "switch") {
      const value = "variable" in step.expression
        ? resolveValue(`\${conversation.${step.expression.variable}}`, conversation.variables)
        : step.expression.value;
      conversation.currentStepId = step.cases.find(item => item.equals === value)?.nextStepId ?? step.defaultStepId;
    } else if (step.type === "goto") {
      conversation.currentStepId = step.targetStepId;
    } else {
      conversation.currentStepId = null;
      conversation.waitingInputStepId = null;
      conversation.status = "completed";
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
