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
  if (expression.operator === "is_empty") return isEmptyValue(left);
  return !isEmptyValue(left);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
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
    const selection = waiting.options
      ? resolveSelectedOption(waiting.options, incomingMessage.trim(), conversation.variables)
      : undefined;
    const selectedValue = waiting.options
      ? selection?.value
      : waiting.transform
        ? transformInput(waiting.transform, incomingMessage.trim())
        : incomingMessage.trim();
    if (selectedValue === undefined) {
      actions.push({
        type: "send_message",
        text: waiting.options?.invalidMessage ?? waiting.transform?.invalidMessage ?? "Opção inválida."
      });
      const prompt = renderInputPrompt(waiting, conversation.variables);
      if (prompt) actions.push({ type: "send_message", text: prompt });
      return { conversation, actions, executedSteps };
    }
    setPath(conversation.variables, waiting.saveTo, selectedValue);
    if (waiting.options?.saveSelectedTo && selection) {
      setPath(conversation.variables, waiting.options.saveSelectedTo, selection.option);
    }
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
      const renderedPrompt = renderInputPrompt(step, conversation.variables);
      if (renderedPrompt) {
        logger?.info("variables_resolved", {
          currentStepId: step.id,
          templateLength: step.prompt?.length ?? 0,
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

      let response: Response;
      try {
        response = await fetch(resolvedUrl, {
          method: step.method,
          headers: resolvedHeaders,
          body: resolvedBody === undefined ? undefined : JSON.stringify(resolvedBody)
        });
      } catch (error) {
        setPath(conversation.variables, step.saveTo, { ok: false, status: 0, data: null });
        const errorStepId = step.onErrorStepId ?? flow.defaultHttpErrorStepId;
        logger?.error("external_request_failed", {
          currentStepId: step.id,
          integrationName: deriveIntegrationName(resolvedUrl),
          httpMethod: step.method,
          durationMs: Date.now() - requestStartedAt
        }, error);
        if (!errorStepId) throw error;
        conversation.currentStepId = errorStepId;
        continue;
      }

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
        const errorStepId = step.onErrorStepId ?? flow.defaultHttpErrorStepId;
        if (errorStepId) {
          logger?.warn("flow_step_completed", {
            currentStepId: step.id,
            nextStepId: errorStepId,
            stepType: step.type
          });
          conversation.currentStepId = errorStepId;
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
type InputOptions = {
  source: string;
  labelField?: string;
  valueField?: string;
  labelFormat?: "datetime_pt_br";
  saveSelectedTo?: string;
  invalidMessage: string;
  emptyMessage: string;
};

function renderInputPrompt(
  step: { prompt?: string; options?: InputOptions },
  variables: Record<string, unknown>
): string | undefined {
  const prompt = step.prompt ? renderTemplate(step.prompt, variables) : undefined;
  if (!step.options) return prompt;

  const options = resolveOptions(step.options, variables);
  const menu = options.length === 0
    ? step.options.emptyMessage
    : options.map((option, index) => `${index + 1} - ${formatOptionLabel(readOptionValue(option, step.options!.labelField), step.options!.labelFormat)}`).join("\n");
  return prompt ? `${prompt}\n${menu}` : menu;
}

function resolveSelectedOption(
  config: InputOptions,
  input: string,
  variables: Record<string, unknown>
): { value: unknown; option: unknown } | undefined {
  if (!/^\d+$/.test(input)) return undefined;
  const selected = resolveOptions(config, variables)[Number(input) - 1];
  if (selected === undefined) return undefined;
  return { value: readOptionValue(selected, config.valueField), option: structuredClone(selected) };
}

function resolveOptions(config: InputOptions, variables: Record<string, unknown>): unknown[] {
  const value = resolveValue(config.source, variables);
  if (!Array.isArray(value)) throw new Error(`Fonte de opções não é uma lista: ${config.source}`);
  return value;
}

function readOptionValue(option: unknown, path?: string): unknown {
  if (!path) {
    if (option === undefined || option === null || typeof option === "object") throw new Error("Opção simples inválida");
    return option;
  }
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, option);
  if (value === undefined || value === null || typeof value === "object") throw new Error(`Campo de opção inválido: ${path}`);
  return value;
}

function formatOptionLabel(value: unknown, format?: InputOptions["labelFormat"]): string {
  if (format !== "datetime_pt_br") return String(value);
  if (typeof value !== "string") throw new Error("Data/hora da opção inválida");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Data/hora inválida: ${value}`);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
type InputTransform = {
  type: "date_pt_br_to_iso_utc";
  allowToday: boolean;
  allowTomorrow: boolean;
  invalidMessage: string;
};

function transformInput(config: InputTransform, input: string): string | undefined {
  if (config.type !== "date_pt_br_to_iso_utc") return undefined;
  const normalized = input.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const today = currentDateInSaoPaulo();

  if (config.allowToday && (normalized === "hoje" || normalized === "1")) {
    return formatIsoUtcStartOfDay(today.year, today.month, today.day);
  }
  if (config.allowTomorrow && (normalized === "amanha" || normalized === "2")) {
    const tomorrow = addCalendarDays(today.year, today.month, today.day, 1);
    return formatIsoUtcStartOfDay(tomorrow.year, tomorrow.month, tomorrow.day);
  }

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    return undefined;
  }
  return formatIsoUtcStartOfDay(year, month, day);
}

function currentDateInSaoPaulo(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function addCalendarDays(year: number, month: number, day: number, amount: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function formatIsoUtcStartOfDay(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`;
}


