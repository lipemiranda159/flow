const PLACEHOLDER = /\$\{([a-zA-Z0-9_.-]+)\}/g;

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (key === "__proto__" || key === "prototype" || key === "constructor") return undefined;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

export function resolveValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;
  const exact = value.match(/^\$\{(?:conversation\.)?([a-zA-Z0-9_.-]+)\}$/);
  if (exact?.[1]) return getPath(variables, exact[1]);
  return renderTemplate(value, variables);
}

export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_match, rawPath: string) => {
    const path = rawPath.startsWith("conversation.") ? rawPath.slice(13) : rawPath;
    const value = getPath(variables, path);
    if (value === undefined) throw new Error(`Variável não encontrada: ${rawPath}`);
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value ?? "");
  });
}

export function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  if (parts.some(part => ["__proto__", "prototype", "constructor"].includes(part))) {
    throw new Error("Nome de variável não permitido");
  }
  let current = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof current[part] !== "object" || current[part] === null || Array.isArray(current[part])) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (!last) throw new Error("Nome de variável vazio");
  current[last] = value;
}
