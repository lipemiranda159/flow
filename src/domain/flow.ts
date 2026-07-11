import { z } from "zod";

const nextStepId = z.string().min(1);

const operandSchema = z.union([
  z.object({ value: z.unknown() }),
  z.object({ variable: z.string().min(1) })
]);

const expressionSchema = z.object({
  operator: z.enum(["equals", "not_equals", "is_empty", "is_not_empty"]),
  left: operandSchema,
  right: operandSchema.optional()
});

const messageStep = z.object({
  id: z.string().min(1), type: z.literal("message"),
  text: z.string().min(1), nextStepId
});
const inputStep = z.object({
  id: z.string().min(1), type: z.literal("input"),
  saveTo: z.string().min(1), prompt: z.string().min(1).optional(), nextStepId,
  options: z.object({
    source: z.string().min(1),
    labelField: z.string().min(1),
    valueField: z.string().min(1),
    saveSelectedTo: z.string().min(1).optional(),
    invalidMessage: z.string().min(1).default("Opção inválida. Digite o número de uma das opções."),
    emptyMessage: z.string().min(1).default("Nenhuma opção disponível.")
  }).optional()
});
const setVariableStep = z.object({
  id: z.string().min(1), type: z.literal("set_variable"),
  variable: z.string().min(1), value: z.unknown(), nextStepId
});
const httpRequestStep = z.object({
  id: z.string().min(1),
  type: z.literal("http_request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().min(1),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.unknown().optional(),
  saveTo: z.string().min(1),
  nextStepId,
  onErrorStepId: z.string().min(1).optional()
});
const conditionStep = z.object({
  id: z.string().min(1), type: z.literal("condition"), expression: expressionSchema,
  thenStepId: nextStepId, elseStepId: nextStepId
});
const switchStep = z.object({
  id: z.string().min(1), type: z.literal("switch"), expression: operandSchema,
  cases: z.array(z.object({ equals: z.unknown(), nextStepId })), defaultStepId: nextStepId
});
const gotoStep = z.object({
  id: z.string().min(1), type: z.literal("goto"), targetStepId: nextStepId
});
const endStep = z.object({
  id: z.string().min(1), type: z.literal("end"), reason: z.string().optional()
});

export const stepSchema = z.discriminatedUnion("type", [
  messageStep, inputStep, setVariableStep, httpRequestStep, conditionStep, switchStep, gotoStep, endStep
]);

export const flowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  entryStepId: z.string().min(1),
  defaultHttpErrorStepId: z.string().min(1).optional(),
  variables: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(stepSchema).min(1).max(1000)
}).superRefine((flow, ctx) => {
  const ids = new Set<string>();
  for (const step of flow.steps) {
    if (ids.has(step.id)) ctx.addIssue({ code: "custom", message: `Step duplicado: ${step.id}` });
    ids.add(step.id);
  }
  if (!ids.has(flow.entryStepId)) ctx.addIssue({ code: "custom", message: "entryStepId inexistente" });
  const references: string[] = flow.defaultHttpErrorStepId ? [flow.defaultHttpErrorStepId] : [];
  for (const step of flow.steps) {
    if ("nextStepId" in step) references.push(step.nextStepId);
    if (step.type === "http_request" && step.onErrorStepId) references.push(step.onErrorStepId);
    if (step.type === "condition") references.push(step.thenStepId, step.elseStepId);
    if (step.type === "switch") references.push(step.defaultStepId, ...step.cases.map(item => item.nextStepId));
    if (step.type === "goto") references.push(step.targetStepId);
  }
  for (const reference of references) {
    if (!ids.has(reference)) ctx.addIssue({ code: "custom", message: `Referência inexistente: ${reference}` });
  }
});

export type Flow = z.infer<typeof flowSchema>;
export type FlowStep = z.infer<typeof stepSchema>;
export type Expression = z.infer<typeof expressionSchema>;



