import { flowSchema } from "../domain/flow.js";

export const exampleFlow = flowSchema.parse({
  id: "schedule",
  name: "Atendimento Agendamento UAI5",
  version: 1,
  entryStepId: "welcome",
  defaultHttpErrorStepId: "default-http-error",
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
      appointments: null
    },
    catalog: {
      businesses: null,
      procedures: null,
      professionals: null,
      availability: null
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
      text: "Para continuar, preciso confirmar sua conta com um código enviado por e-mail.",
      nextStepId: "auth-email"
    },
    {
      id: "auth-email",
      type: "input",
      saveTo: "auth.email",
      prompt: "Informe seu e-mail para solicitar o código de acesso.",
      nextStepId: "auth-request-code"
    },
    {
      id: "auth-request-code",
      type: "http_request",
      method: "POST",
      url: "${conversation.api.baseUrl}/api/passwordless/request",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        email: "${conversation.auth.email}"
      },
      saveTo: "auth.request",
      nextStepId: "auth-code"
    },
    {
      id: "auth-code",
      type: "input",
      saveTo: "auth.code",
      prompt: "Digite o código de 6 dígitos recebido por e-mail.",
      nextStepId: "auth-login"
    },
    {
      id: "auth-login",
      type: "http_request",
      method: "POST",
      url: "${conversation.api.baseUrl}/api/passwordless/login",
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        email: "${conversation.auth.email}",
        code: "${conversation.auth.code}"
      },
      saveTo: "auth.login",
      onErrorStepId: "auth-failed",
      nextStepId: "auth-set-token"
    },
    {
      id: "auth-set-token",
      type: "set_variable",
      variable: "auth.token",
      value: "${conversation.auth.login.data.data.token}",
      nextStepId: "auth-profile"
    },
    {
      id: "auth-profile",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/auth/profile",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "auth.profile",
      onErrorStepId: "auth-failed",
      nextStepId: "auth-set-user"
    },
    {
      id: "auth-set-user",
      type: "set_variable",
      variable: "auth.userId",
      value: "${conversation.auth.profile.data.nameid}",
      nextStepId: "intent-switch"
    },
    {
      id: "auth-failed",
      type: "message",
      text: "Não consegui validar seu acesso. Vamos tentar novamente com um novo código.",
      nextStepId: "auth-email"
    },

    {
      id: "intent-switch",
      type: "switch",
      expression: { variable: "flowIntent" },
      cases: [
        { equals: "schedule", nextStepId: "schedule-businesses-list-instructions" },
        { equals: "list_appointments", nextStepId: "appointments-call" },
        { equals: "list_procedures", nextStepId: "procedures-businesses-list" }
      ],
      defaultStepId: "continue-input"
    },

    {
      id: "schedule-businesses-list-instructions",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/businesses?pageNumber=1&pageSize=10&searchTerm=",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.businesses",
      onErrorStepId: "auth-failed",
      nextStepId: "schedule-business"
    },
    {
      id: "schedule-business-select-prompt",
      type: "message",
      text: "Encontrei estes estabelecimentos:\n${conversation.catalog.businesses.data.businesses}\nDigite o código (id) do estabelecimento desejado.",
      nextStepId: "schedule-business"
    },
    {
      id: "schedule-business",
      type: "input",
      saveTo: "scheduling.businessId",
      prompt: "Encontrei estes estabelecimentos. Escolha uma opção:",
      options: {
        source: "${conversation.catalog.businesses.data.businesses}",
        labelField: "name",
        valueField: "id"
      },
      nextStepId: "schedule-procedure-list-instructions"
    },
    {
      id: "schedule-procedure-list-instructions",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/procedures/business/${conversation.scheduling.businessId}",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.procedures",
      onErrorStepId: "auth-failed",
      nextStepId: "schedule-procedure-select-prompt"
    },
    {
      id: "schedule-procedure-select-prompt",
      type: "message",
      text: "Estes são os procedimentos disponíveis:\n${conversation.catalog.procedures.data}\nDigite o código (id) do procedimento escolhido.",
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
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/businesses/${conversation.scheduling.businessId}/professional",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.professionals",
      onErrorStepId: "auth-failed",
      nextStepId: "schedule-professional-select-prompt"
    },
    {
      id: "schedule-professional-select-prompt",
      type: "message",
      text: "Profissionais disponíveis neste estabelecimento:\n${conversation.catalog.professionals.data.data.user}\nDigite o código (id) do profissional desejado.",
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
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/businesses/${conversation.scheduling.businessId}/professional/${conversation.scheduling.professionalId}/available/procedure/${conversation.scheduling.procedureId}?date=${conversation.scheduling.requestedDate}",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.availability",
      onErrorStepId: "auth-failed",
      nextStepId: "schedule-availability-select-prompt"
    },
    {
      id: "schedule-availability-select-prompt",
      type: "message",
      text: "Horários disponíveis para a data escolhida:\n${conversation.catalog.availability.data.data.availableTimes}\nDigite o horário exatamente como aparece na lista.",
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
      prompt: "Qual preço foi mostrado para esse procedimento?",
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
      type: "http_request",
      method: "POST",
      url: "${conversation.api.baseUrl}/api/appointment",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}",
        "Content-Type": "application/json"
      },
      body: {
        appointment: {
          id: "${conversation.auth.userId}",
          userId: "${conversation.auth.userId}",
          businessId: "${conversation.scheduling.businessId}",
          professionalId: "${conversation.scheduling.professionalId}",
          procedureId: "${conversation.scheduling.procedureId}",
          scheduledAt: "${conversation.scheduling.scheduledAt}",
          isDelivery: false
        }
      },
      saveTo: "scheduling.create",
      onErrorStepId: "schedule-create-error",
      nextStepId: "schedule-set-created-id"
    },
    {
      id: "schedule-set-created-id",
      type: "set_variable",
      variable: "scheduling.createResultId",
      value: "${conversation.scheduling.create.data.data.id}",
      nextStepId: "schedule-created-message"
    },
    {
      id: "schedule-created-message",
      type: "message",
      text: "Agendamento confirmado com sucesso! ID: ${conversation.scheduling.createResultId}",
      nextStepId: "continue-input"
    },
    {
      id: "schedule-create-error",
      type: "message",
      text: "Não consegui confirmar seu agendamento agora. Posso consultar seus agendamentos para verificar se foi criado.",
      nextStepId: "appointments-call"
    },
    {
      id: "schedule-cancelled",
      type: "message",
      text: "Agendamento cancelado antes da criação. Nenhum POST foi executado.",
      nextStepId: "continue-input"
    },

    {
      id: "appointments-call",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/appointment/user",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "records.appointments",
      onErrorStepId: "auth-failed",
      nextStepId: "appointments-result"
    },
    {
      id: "appointments-result",
      type: "message",
      text: "Aqui estão seus agendamentos:\n${conversation.records.appointments.data.data.appointments}",
      nextStepId: "continue-input"
    },

    {
      id: "procedures-businesses-list",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/businesses?pageNumber=1&pageSize=10&searchTerm=",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.businesses",
      onErrorStepId: "auth-failed",
      nextStepId: "procedures-business"
    },
    {
      id: "procedures-businesses-prompt",
      type: "message",
      text: "Para consultar procedimentos, escolha um estabelecimento:\n${conversation.catalog.businesses.data.businesses}",
      nextStepId: "procedures-business"
    },
    {
      id: "procedures-business",
      type: "input",
      saveTo: "scheduling.businessId",
      prompt: "Para consultar procedimentos, escolha um estabelecimento:",
      options: {
        source: "${conversation.catalog.businesses.data.businesses}",
        labelField: "name",
        valueField: "id"
      },
      nextStepId: "procedures-call"
    },
    {
      id: "procedures-call",
      type: "http_request",
      method: "GET",
      url: "${conversation.api.baseUrl}/api/procedures/business/${conversation.scheduling.businessId}",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "catalog.procedures",
      onErrorStepId: "auth-failed",
      nextStepId: "procedures-result"
    },
    {
      id: "procedures-result",
      type: "message",
      text: "Estes são os procedimentos disponíveis:\n${conversation.catalog.procedures.data}",
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
{
      id: "default-http-error",
      type: "message",
      text: "Desculpe, estamos com problemas no momento. Tente novamente mais tarde.",
      nextStepId: "default-http-error-end"
    },
    { id: "default-http-error-end", type: "end", reason: "http_error" },
    { id: "end", type: "end", reason: "completed" }
  ]
});


