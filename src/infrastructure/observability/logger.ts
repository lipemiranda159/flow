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
  constructor(private readonly baseContext: Partial<LogContext> = {}) {}

  child(context: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context });
  }

  info(event: string, context: Partial<LogContext> = {}): void {
    this.emit("info", event, context);
  }

  warn(event: string, context: Partial<LogContext> = {}): void {
    this.emit("warn", event, context);
  }

  error(event: string, context: Partial<LogContext> = {}, error?: unknown): void {
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
      return;
    }

    if (level === "warn") {
      console.warn(message);
      return;
    }

    console.log(message);
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
