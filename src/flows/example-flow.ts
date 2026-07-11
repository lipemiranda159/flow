import { flowSchema } from "../domain/flow.js";

export const exampleFlow = flowSchema.parse({
  id: "barbershop-flow",
  name: "Atendimento Barbearia",
  version: 1,
  entryStepId: "welcome",
  variables: {
    menuOption: null,
    continueOption: null,
    appointment: {
      customerName: null,
      service: null,
      datetime: null
    },
    lookup: {
      customerName: null,
      phoneSuffix: null
    }
  },
  steps: [
    {
      id: "welcome",
      type: "message",
      text: "Bem-vindo a Barbearia Corte Fino!", nextStepId: "menu-input"
    },
    {
      id: "menu-input",
      type: "input",
      saveTo: "menuOption",
      prompt: "Digite uma opção:\n1 - Agendar horário\n2 - Buscar horário marcado\n3 - Ver procedimentos",
      nextStepId: "menu-switch"
    },
    {
      id: "menu-switch",
      type: "switch",
      expression: { variable: "menuOption" },
      cases: [
        { equals: "1", nextStepId: "schedule-name" },
        { equals: "2", nextStepId: "lookup-name" },
        { equals: "3", nextStepId: "procedures" }
      ],
      defaultStepId: "invalid-option"
    },
    {
      id: "invalid-option",
      type: "message",
      text: "Opção inválida. Responda com 1, 2 ou 3.",
      nextStepId: "menu-input"
    },

    {
      id: "schedule-name",
      type: "input",
      saveTo: "appointment.customerName",
      prompt: "Perfeito! Qual é o seu nome?",
      nextStepId: "schedule-service"
    },
    {
      id: "schedule-service",
      type: "input",
      saveTo: "appointment.service",
      prompt: "Qual serviço deseja agendar? (corte, barba, corte+barba)",
      nextStepId: "schedule-datetime"
    },
    {
      id: "schedule-datetime",
      type: "input",
      saveTo: "appointment.datetime",
      prompt: "Informe o melhor dia e horário para você.",
      nextStepId: "schedule-confirm"
    },
    {
      id: "schedule-confirm",
      type: "message",
      text: "Agendamento solicitado com sucesso!\nNome: ${conversation.appointment.customerName}\nServiço: ${conversation.appointment.service}\nHorário desejado: ${conversation.appointment.datetime}\nNossa equipe vai confirmar em seguida.",
      nextStepId: "continue-input"
    },

    {
      id: "lookup-name",
      type: "input",
      saveTo: "lookup.customerName",
      prompt: "Para buscar seu horário, informe seu nome.",
      nextStepId: "lookup-phone"
    },
    {
      id: "lookup-phone",
      type: "input",
      saveTo: "lookup.phoneSuffix",
      prompt: "Agora informe os 4 últimos dígitos do seu telefone.",
      nextStepId: "lookup-result"
    },
    {
      id: "lookup-result",
      type: "message",
      text: "Busca registrada para ${conversation.lookup.customerName}.\nAinda não temos integração com agenda externa, mas um atendente vai confirmar seu horário pelo telefone final ${conversation.lookup.phoneSuffix}.",
      nextStepId: "continue-input"
    },

    {
      id: "procedures",
      type: "message",
      text: "Procedimentos disponíveis:\n- Corte tradicional\n- Barba completa\n- Corte + barba\n- Hidratação capilar\nSe quiser agendar, responda com 1 no menu inicial.",
      nextStepId: "continue-input"
    },
    {
      id: "continue-input",
      type: "input",
      saveTo: "continueOption",
      prompt: "Deseja voltar ao menu? (sim/nao)",
      nextStepId: "continue-switch"
    },
    {
      id: "continue-switch",
      type: "switch",
      expression: { variable: "continueOption" },
      cases: [
        { equals: "sim", nextStepId: "menu-input" },
        { equals: "s", nextStepId: "menu-input" },
        { equals: "nao", nextStepId: "continue-end" },
        { equals: "não", nextStepId: "continue-end" },
        { equals: "n", nextStepId: "continue-end" }
      ],
      defaultStepId: "continue-invalid"
    },
    {
      id: "continue-invalid",
      type: "message",
      text: "Resposta inválida. Digite 'sim' para voltar ao menu ou 'nao' para encerrar.",
      nextStepId: "continue-input"
    },
    {
      id: "continue-end",
      type: "message",
      text: "Obrigado pelo contato com a Barbearia Corte Fino! Até logo.",
      nextStepId: "end"
    },
    { id: "end", type: "end", reason: "completed" }
  ]
});
