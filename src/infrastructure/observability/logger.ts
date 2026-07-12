import { randomUUID } from "node:crypto";
import { createApplicationEventRepository } from "../application-event-repository-factory.js";
export type LogLevel = "info" | "warn" | "error";

type LogContext = {
  correlationId: string;
  messageId?: string;
  userId?: string;
  flowId?: string;
  currentStepId?: string;
  nextStepId?: string;
  durationMs?: number;
  [key: string]: unknown;
};

export class StructuredLogger {
  constructor(
    private readonly baseContext: Partial<LogContext> = {},
    private readonly pending: Set<Promise<void>> = new Set()
  ) {}

  child(context: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context }, this.pending);
  }

  info(event: string, context: Partial<LogContext> = {}): void {
    console.log(`INFO: ${event}`, { ...this.baseContext, ...context });
    this.emit("info", event, context);
  }

  warn(event: string, context: Partial<LogContext> = {}): void {
    console.warn(`WARN: ${event}`, { ...this.baseContext, ...context });
    this.emit("warn", event, context);
  }

  error(event: string, context: Partial<LogContext> = {}, error?: unknown): void {
    console.error(`ERROR: ${event}`, { ...this.baseContext, ...context, error });
    const errorPayload = error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message,
          stack: error.stack
        }
      : error === undefined
        ? {}
        : {
            errorName: "UnknownError",
            errorMessage: String(error)
          };

    this.emit("error", event, { ...context, ...errorPayload });
  }

  private emit(level: LogLevel, event: string, context: Partial<LogContext>): void {
    const payload = {
      level,
      event,
      ...sanitizeContext({ ...this.baseContext, ...context }),
      timestamp: new Date().toISOString()
    };

    const message = JSON.stringify(payload);

    if (level === "error") {
      console.error(message);
    } else if (level === "warn") {
      console.warn(message);
    } else {
      console.log(message);
    }

this.track(createApplicationEventRepository().save({
      id: randomUUID(),
      level,
      event,
      context: payload,
      createdAt: new Date()
    }).catch(error => {
      console.warn(JSON.stringify({
        level: "warn",
        event: "application_event_persist_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }));
    }));

    this.track(sendToAxiomIfEnabled(payload).catch((error) => {
      const errorPayload = {
        level: "warn",
        event: "axiom_ingest_failed",
        ...sanitizeContext({ ...this.baseContext }),
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };
      console.warn(JSON.stringify(errorPayload));
    }));
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  private track(task: Promise<void>): void {
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) {
      continue;
    }

    if (isSensitiveKey(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null) {
    return value;
  }

  if (typeof value === "string") {
    if (isSensitiveKey(key)) {
      return "[REDACTED]";
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(key, item));
  }

  if (typeof value === "object") {
    return sanitizeContext(value as Record<string, unknown>);
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  return /(authorization|token|secret|password|cookie|api[-_]?key)/i.test(key);
}

async function sendToAxiomIfEnabled(payload: Record<string, unknown>): Promise<void> {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;

  if (!token || !dataset) {
    return;
  }

  const ingestUrl = process.env.AXIOM_INGEST_URL ?? `https://api.axiom.co/v1/datasets/${dataset}/ingest`;

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify([payload])
  });

  if (!response.ok) {
    throw new Error(`Axiom ingest failed with status ${response.status}`);
  }
}

