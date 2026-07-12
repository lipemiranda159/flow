import { flowSchema } from "../domain/flow.js";

export const exampleFlow = flowSchema.parse({
  id: "schedule",
  name: "Atendimento Agendamento UAI5",
  version: 1,
  entryStepId: "welcome",
  defaultHttpErrorStepId: "default-http-error",
  persistentVariables: ["auth"],
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
      selectedBusiness: null,
      procedureId: null,
      selectedProcedure: null,
      professionalId: null,
      selectedProfessional: null,
      requestedDate: null,
      scheduledAt: null,
      selectedTimeLabel: null,
      finalPrice: null,
      confirmation: null,
      createResultId: null
    },
    records: {
      appointments: null,
      selectedAppointmentId: null,
      selectedAppointment: null,
      selectedAppointmentLabel: null,
      appointmentAction: null,
      cancelResult: null
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
      nextStepId: "auth-check"
    },
    {
      id: "set-intent-list-appointments",
      type: "set_variable",
      variable: "flowIntent",
      value: "list_appointments",
      nextStepId: "auth-check"
    },
    {
      id: "set-intent-list-procedures",
      type: "set_variable",
      variable: "flowIntent",
      value: "list_procedures",
      nextStepId: "auth-check"
    },

    {
      id: "auth-check",
      type: "condition",
      expression: { operator: "is_not_empty", left: { variable: "auth.token" } },
      thenStepId: "intent-switch",
      elseStepId: "auth-intro"
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
        valueField: "id",
        saveSelectedTo: "scheduling.selectedBusiness"
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
      nextStepId: "schedule-procedure-id"
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
      prompt: "Estes são os procedimentos disponíveis. Escolha uma opção:",
      options: {
        source: "${conversation.catalog.procedures.data.data.procedures}",
        labelField: "name",
        valueField: "id",
        saveSelectedTo: "scheduling.selectedProcedure"
      },
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
      nextStepId: "schedule-professional-id"
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
      prompt: "Profissionais disponíveis neste estabelecimento. Escolha uma opção:",
      options: {
        source: "${conversation.catalog.professionals.data.data.users}",
        labelField: "name",
        valueField: "id",
        saveSelectedTo: "scheduling.selectedProfessional"
      },
      nextStepId: "schedule-date"
    },
    {
      id: "schedule-date",
      type: "input",
      saveTo: "scheduling.requestedDate",
      prompt: "Escolha a data desejada:\n1 - Hoje\n2 - Amanhã\nOu digite outra data no formato DD/MM/AAAA.",
      transform: {
        type: "date_pt_br_to_iso_utc",
        allowToday: true,
        allowTomorrow: true
      },
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
      nextStepId: "schedule-availability-check"
    },
    {
      id: "schedule-availability-check",
      type: "condition",
      expression: {
        operator: "is_empty",
        left: { variable: "catalog.availability.data.data.availableTimes" }
      },
      thenStepId: "schedule-no-availability",
      elseStepId: "schedule-time"
    },
    {
      id: "schedule-no-availability",
      type: "message",
      text: "Não encontrei horários disponíveis para essa data. Escolha outra data para tentarmos novamente.",
      nextStepId: "schedule-date"
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
      prompt: "Escolha um dos horários disponíveis:",
      options: {
        source: "${conversation.catalog.availability.data.data.availableTimes}",
        labelFormat: "datetime_pt_br",
        saveLabelTo: "scheduling.selectedTimeLabel"
      },
      nextStepId: "schedule-summary"
    },
    
    {
      id: "schedule-summary",
      type: "message",
      text: "Resumo para confirmação:\n- Estabelecimento: ${conversation.scheduling.selectedBusiness.name}\n- Procedimento: ${conversation.scheduling.selectedProcedure.name}\n- Profissional: ${conversation.scheduling.selectedProfessional.name}\n- Data e horário: ${conversation.scheduling.selectedTimeLabel}\n- Preço: R$ ${conversation.scheduling.selectedProcedure.price}\nConfirme com 'sim' para criar ou 'nao' para cancelar.",
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
      nextStepId: "appointments-check"
    },
    {
      id: "appointments-check",
      type: "condition",
      expression: {
        operator: "is_empty",
        left: { variable: "records.appointments.data.data.appointments" }
      },
      thenStepId: "appointments-empty",
      elseStepId: "appointments-select"
    },
    {
      id: "appointments-empty",
      type: "message",
      text: "Você não possui agendamentos no momento.",
      nextStepId: "continue-input"
    },
    {
      id: "appointments-select",
      type: "input",
      saveTo: "records.selectedAppointmentId",
      prompt: "Escolha um agendamento para ver os detalhes:",
      options: {
        source: "${conversation.records.appointments.data.data.appointments}",
        valueField: "id",
        labelTemplate: "${option.joins.procedure.name} — ${option.scheduledAt|datetime_pt_br_wall}",
        saveSelectedTo: "records.selectedAppointment",
        saveLabelTo: "records.selectedAppointmentLabel"
      },
      nextStepId: "appointments-summary"
    },
    {
      id: "appointments-summary",
      type: "message",
      text: "Resumo do agendamento:\n- Procedimento e horário: ${conversation.records.selectedAppointmentLabel}\n- Estabelecimento: ${conversation.records.selectedAppointment.joins.business.name}\n- Profissional: ${conversation.records.selectedAppointment.joins.professional.name}\n- Preço: R$ ${conversation.records.selectedAppointment.joins.procedure.price}",
      nextStepId: "appointments-action"
    },
    {
      id: "appointments-action",
      type: "input",
      saveTo: "records.appointmentAction",
      prompt: "O que deseja fazer?\n1 - Cancelar este agendamento\n2 - Voltar ao menu",
      nextStepId: "appointments-action-switch"
    },
    {
      id: "appointments-action-switch",
      type: "switch",
      expression: { variable: "records.appointmentAction" },
      cases: [
        { equals: "1", nextStepId: "appointments-cancel-call" },
        { equals: "2", nextStepId: "menu-input" }
      ],
      defaultStepId: "appointments-action-invalid"
    },
    {
      id: "appointments-action-invalid",
      type: "message",
      text: "Opção inválida. Digite 1 para cancelar ou 2 para voltar ao menu.",
      nextStepId: "appointments-action"
    },
    {
      id: "appointments-cancel-call",
      type: "http_request",
      method: "DELETE",
      url: "${conversation.api.baseUrl}/api/appointment/${conversation.records.selectedAppointmentId}",
      headers: {
        Authorization: "Bearer ${conversation.auth.token}"
      },
      saveTo: "records.cancelResult",
      nextStepId: "appointments-cancelled"
    },
    {
      id: "appointments-cancelled",
      type: "message",
      text: "Agendamento cancelado com sucesso.",
      nextStepId: "menu-input"
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
        valueField: "id",
        saveSelectedTo: "scheduling.selectedBusiness"
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
      nextStepId: "procedures-select"
    },
    {
      id: "procedures-select",
      type: "input",
      saveTo: "scheduling.procedureId",
      prompt: "Estes são os procedimentos disponíveis. Escolha uma opção:",
      options: {
        source: "${conversation.catalog.procedures.data.data.procedures}",
        labelField: "name",
        valueField: "id",
        saveSelectedTo: "scheduling.selectedProcedure"
      },
      nextStepId: "procedures-result"
    },
    {
      id: "procedures-result",
      type: "message",
      text: "Procedimento selecionado:\nNome: ${conversation.scheduling.selectedProcedure.name}\nDescrição: ${conversation.scheduling.selectedProcedure.description}\nDuração: ${conversation.scheduling.selectedProcedure.durationMinutes} minutos\nPreço: R$ ${conversation.scheduling.selectedProcedure.price}",
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












