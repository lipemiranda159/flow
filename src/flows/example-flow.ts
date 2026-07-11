import { flowSchema } from "../domain/flow.js";

export const exampleFlow = flowSchema.parse({
  id: "uai5-appointment-flow",
  name: "Atendimento Agendamento UAI5",
  version: 1,
  entryStepId: "welcome",
  variables: {
    menuOption: null,
    continueOption: null,
    flowIntent: null,
    api: {
      baseUrl: "https://api.uai5solutions.com.br"
    },
    auth: {
      email: null,
      code: null,
      token: null,
      userId: null
    },
    scheduling: {
      businessId: null,
      procedureId: null,
      professionalId: null,
      requestedDate: null,
      scheduledAt: null,
      finalPrice: null,
      confirmation: null,
      createResultId: null
    },
    records: {
      businessesSummary: null,
      proceduresSummary: null,
      professionalsSummary: null,
      availableTimesSummary: null,
      appointmentsSummary: null
    }
  },
  steps: [
    {
      id: "welcome",
      type: "message",
      text: "Bem-vindo ao fluxo de agendamento da UAI5 Solutions.",
      nextStepId: "menu-input"
    },
    {
      id: "menu-input",
      type: "input",
      saveTo: "menuOption",
      prompt: "Escolha uma opção:\n1 - Iniciar agendamento\n2 - Listar meus agendamentos\n3 - Consultar procedimentos",
      nextStepId: "menu-switch"
    },
    {
      id: "menu-switch",
      type: "switch",
      expression: { variable: "menuOption" },
      cases: [
        { equals: "1", nextStepId: "set-intent-schedule" },
        { equals: "2", nextStepId: "set-intent-list-appointments" },
        { equals: "3", nextStepId: "set-intent-list-procedures" }
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
      id: "set-intent-schedule",
      type: "set_variable",
      variable: "flowIntent",
      value: "schedule",
      nextStepId: "auth-intro"
    },
    {
      id: "set-intent-list-appointments",
      type: "set_variable",
      variable: "flowIntent",
      value: "list_appointments",
      nextStepId: "auth-intro"
    },
    {
      id: "set-intent-list-procedures",
      type: "set_variable",
      variable: "flowIntent",
      value: "list_procedures",
      nextStepId: "auth-intro"
    },

    {
      id: "auth-intro",
      type: "message",
      text: "Para continuar, vamos autenticar via passwordless. As chamadas seguem ${conversation.api.baseUrl}.",
      nextStepId: "auth-email"
    },
    {
      id: "auth-email",
      type: "input",
      saveTo: "auth.email",
      prompt: "Informe seu e-mail para solicitar o código de acesso.",
      nextStepId: "auth-request-instructions"
    },
    {
      id: "auth-request-instructions",
      type: "message",
      text: "Solicite o código com POST ${conversation.api.baseUrl}/api/passwordless/request usando o e-mail informado.",
      nextStepId: "auth-code"
    },
    {
      id: "auth-code",
      type: "input",
      saveTo: "auth.code",
      prompt: "Digite o código de 6 dígitos recebido por e-mail.",
      nextStepId: "auth-login-instructions"
    },
    {
      id: "auth-login-instructions",
      type: "message",
      text: "Valide o código com POST ${conversation.api.baseUrl}/api/passwordless/login e capture data.token.",
      nextStepId: "auth-token"
    },
    {
      id: "auth-token",
      type: "input",
      saveTo: "auth.token",
      prompt: "Cole o JWT retornado em data.token.",
      nextStepId: "auth-profile-instructions"
    },
    {
      id: "auth-profile-instructions",
      type: "message",
      text: "Com Authorization Bearer, faça GET ${conversation.api.baseUrl}/api/auth/profile e capture o campo nameid.",
      nextStepId: "auth-user-id"
    },
    {
      id: "auth-user-id",
      type: "input",
      saveTo: "auth.userId",
      prompt: "Informe o nameid retornado no profile (userId da sessão).",
      nextStepId: "intent-switch"
    },

    {
      id: "intent-switch",
      type: "switch",
      expression: { variable: "flowIntent" },
      cases: [
        { equals: "schedule", nextStepId: "schedule-business" },
        { equals: "list_appointments", nextStepId: "appointments-call" },
        { equals: "list_procedures", nextStepId: "procedures-business" }
      ],
      defaultStepId: "continue-input"
    },

    {
      id: "schedule-businesses-list-instructions",
      type: "message",
      text: "Liste estabelecimentos com GET ${conversation.api.baseUrl}/api/businesses?pageNumber=1&pageSize=10&searchTerm=. Exiba apenas opções ativas.",
      nextStepId: "schedule-businesses-summary"
    },
    {
      id: "schedule-businesses-summary",
      type: "input",
      saveTo: "records.businessesSummary",
      prompt: "Cole uma lista curta de estabelecimentos no formato Nome -> businessId.",
      nextStepId: "schedule-business-select-prompt"
    },
    {
      id: "schedule-business-select-prompt",
      type: "message",
      text: "Escolha um estabelecimento desta lista:\n${conversation.records.businessesSummary}",
      nextStepId: "schedule-business"
    },
    {
      id: "schedule-business",
      type: "input",
      saveTo: "scheduling.businessId",
      prompt: "Digite o businessId escolhido na lista.",
      nextStepId: "schedule-procedure-list-instructions"
    },
    {
      id: "schedule-procedure-list-instructions",
      type: "message",
      text: "Liste os procedimentos com GET ${conversation.api.baseUrl}/api/procedures/business/${conversation.scheduling.businessId}. Use apenas IDs retornados pela API.",
      nextStepId: "schedule-procedures-summary"
    },
    {
      id: "schedule-procedures-summary",
      type: "input",
      saveTo: "records.proceduresSummary",
      prompt: "Cole os procedimentos em formato Nome (duração/preço) -> procedureId.",
      nextStepId: "schedule-procedure-select-prompt"
    },
    {
      id: "schedule-procedure-select-prompt",
      type: "message",
      text: "Escolha um procedimento desta lista:\n${conversation.records.proceduresSummary}",
      nextStepId: "schedule-procedure-id"
    },
    {
      id: "schedule-procedure-id",
      type: "input",
      saveTo: "scheduling.procedureId",
      prompt: "Digite o procedureId escolhido na lista.",
      nextStepId: "schedule-professionals-instructions"
    },
    {
      id: "schedule-professionals-instructions",
      type: "message",
      text: "Liste profissionais com GET ${conversation.api.baseUrl}/api/businesses/${conversation.scheduling.businessId}/professional e escolha somente um ID retornado.",
      nextStepId: "schedule-professionals-summary"
    },
    {
      id: "schedule-professionals-summary",
      type: "input",
      saveTo: "records.professionalsSummary",
      prompt: "Cole os profissionais no formato Nome -> professionalId.",
      nextStepId: "schedule-professional-select-prompt"
    },
    {
      id: "schedule-professional-select-prompt",
      type: "message",
      text: "Escolha um profissional desta lista:\n${conversation.records.professionalsSummary}",
      nextStepId: "schedule-professional-id"
    },
    {
      id: "schedule-professional-id",
      type: "input",
      saveTo: "scheduling.professionalId",
      prompt: "Digite o professionalId escolhido na lista.",
      nextStepId: "schedule-date"
    },
    {
      id: "schedule-date",
      type: "input",
      saveTo: "scheduling.requestedDate",
      prompt: "Informe a data desejada no formato YYYY-MM-DD.",
      nextStepId: "schedule-availability-instructions"
    },
    {
      id: "schedule-availability-instructions",
      type: "message",
      text: "Consulte disponibilidade em GET ${conversation.api.baseUrl}/api/businesses/${conversation.scheduling.businessId}/professional/${conversation.scheduling.professionalId}/available/procedure/${conversation.scheduling.procedureId}?date=${conversation.scheduling.requestedDate}. Ofereça somente horários retornados em availableTimes.",
      nextStepId: "schedule-availability-summary"
    },
    {
      id: "schedule-availability-summary",
      type: "input",
      saveTo: "records.availableTimesSummary",
      prompt: "Cole os horários disponíveis em formato de lista usando os valores ISO originais.",
      nextStepId: "schedule-availability-select-prompt"
    },
    {
      id: "schedule-availability-select-prompt",
      type: "message",
      text: "Escolha um horário desta lista:\n${conversation.records.availableTimesSummary}",
      nextStepId: "schedule-time"
    },
    {
      id: "schedule-time",
      type: "input",
      saveTo: "scheduling.scheduledAt",
      prompt: "Informe exatamente o horário ISO escolhido dentre os disponíveis.",
      nextStepId: "schedule-price"
    },
    {
      id: "schedule-price",
      type: "input",
      saveTo: "scheduling.finalPrice",
      prompt: "Informe o preço final retornado para este procedimento (não altere o valor da API).",
      nextStepId: "schedule-summary"
    },
    {
      id: "schedule-summary",
      type: "message",
      text: "Resumo para confirmação:\n- businessId: ${conversation.scheduling.businessId}\n- procedureId: ${conversation.scheduling.procedureId}\n- professionalId: ${conversation.scheduling.professionalId}\n- scheduledAt: ${conversation.scheduling.scheduledAt}\n- preço: ${conversation.scheduling.finalPrice}\nConfirme com 'sim' para criar ou 'nao' para cancelar.",
      nextStepId: "schedule-confirmation"
    },
    {
      id: "schedule-confirmation",
      type: "input",
      saveTo: "scheduling.confirmation",
      prompt: "Deseja criar o agendamento agora? (sim/nao)",
      nextStepId: "schedule-confirmation-switch"
    },
    {
      id: "schedule-confirmation-switch",
      type: "switch",
      expression: { variable: "scheduling.confirmation" },
      cases: [
        { equals: "sim", nextStepId: "schedule-create-instructions" },
        { equals: "s", nextStepId: "schedule-create-instructions" },
        { equals: "nao", nextStepId: "schedule-cancelled" },
        { equals: "não", nextStepId: "schedule-cancelled" },
        { equals: "n", nextStepId: "schedule-cancelled" }
      ],
      defaultStepId: "schedule-confirmation-invalid"
    },
    {
      id: "schedule-confirmation-invalid",
      type: "message",
      text: "Resposta inválida. Digite 'sim' para criar ou 'nao' para cancelar.",
      nextStepId: "schedule-confirmation"
    },
    {
      id: "schedule-create-instructions",
      type: "message",
      text: "Crie uma única vez em POST ${conversation.api.baseUrl}/api/appointment com payload appointment usando userId=${conversation.auth.userId}, businessId, professionalId, procedureId e scheduledAt selecionados. Não repita automaticamente em timeout.",
      nextStepId: "schedule-created-id"
    },
    {
      id: "schedule-created-id",
      type: "input",
      saveTo: "scheduling.createResultId",
      prompt: "Informe o data.id retornado pela API após success=true.",
      nextStepId: "schedule-created-message"
    },
    {
      id: "schedule-created-message",
      type: "message",
      text: "Agendamento confirmado com sucesso! ID: ${conversation.scheduling.createResultId}",
      nextStepId: "continue-input"
    },
    {
      id: "schedule-cancelled",
      type: "message",
      text: "Agendamento cancelado antes da criação. Nenhum POST foi executado.",
      nextStepId: "continue-input"
    },

    {
      id: "appointments-call",
      type: "message",
      text: "Liste seus agendamentos com GET ${conversation.api.baseUrl}/api/appointment/user usando Authorization Bearer.",
      nextStepId: "appointments-summary"
    },
    {
      id: "appointments-summary",
      type: "input",
      saveTo: "records.appointmentsSummary",
      prompt: "Cole um resumo dos próximos agendamentos (ID, data, profissional, procedimento).",
      nextStepId: "appointments-result"
    },
    {
      id: "appointments-result",
      type: "message",
      text: "Resumo registrado:\n${conversation.records.appointmentsSummary}",
      nextStepId: "continue-input"
    },

    {
      id: "procedures-business",
      type: "input",
      saveTo: "scheduling.businessId",
      prompt: "Informe o businessId para consultar procedimentos.",
      nextStepId: "procedures-call"
    },
    {
      id: "procedures-call",
      type: "message",
      text: "Consulte em GET ${conversation.api.baseUrl}/api/procedures/business/${conversation.scheduling.businessId}. Apresente nome, duração e preço sem alterar os valores.",
      nextStepId: "procedures-summary"
    },
    {
      id: "procedures-summary",
      type: "input",
      saveTo: "records.proceduresSummary",
      prompt: "Cole um resumo dos procedimentos retornados.",
      nextStepId: "procedures-result"
    },
    {
      id: "procedures-result",
      type: "message",
      text: "Procedimentos registrados:\n${conversation.records.proceduresSummary}",
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
      text: "Atendimento finalizado. Quando quiser, iniciamos um novo fluxo de agendamento.",
      nextStepId: "end"
    },
    { id: "end", type: "end", reason: "completed" }
  ]
});
