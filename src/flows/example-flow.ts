import { flowSchema } from "../domain/flow.js";

export const exampleFlow = flowSchema.parse({
  id: "welcome-flow",
  name: "Boas-vindas",
  version: 1,
  entryStepId: "welcome",
  variables: { name: null },
  steps: [
    { id: "welcome", type: "message", text: "Olá! Qual é o seu nome?", nextStepId: "name-input" },
    { id: "name-input", type: "input", saveTo: "name", nextStepId: "greeting" },
    { id: "greeting", type: "message", text: "Prazer em conhecer você, ${conversation.name}!", nextStepId: "end" },
    { id: "end", type: "end", reason: "completed" }
  ]
});
