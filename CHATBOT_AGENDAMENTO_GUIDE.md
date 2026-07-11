# Integração de chatbot para agendamentos

Este guia define o fluxo mínimo para um chatbot que:

1. lista os estabelecimentos para o usuário selecionar;
2. busca os procedimentos do estabelecimento selecionado;
3. lista os profissionais para o usuário selecionar;
4. consulta horários disponíveis do profissional escolhido;
5. confirma e cria o agendamento;
6. lista os agendamentos do usuário autenticado.

Use `{BASE_URL}/swagger` para conferir o contrato do ambiente. A solicitação e a validação do código são públicas; depois do login, todas as operações de agenda exigem JWT Bearer.

```http
Authorization: Bearer <token>
Content-Type: application/json
```

## Dados que o chatbot precisa manter

| Dado | Origem |
|---|---|
| `token` | `POST /api/passwordless/login` |
| `userId` | Campo `nameid` de `GET /api/auth/profile` |
| `businessId` | `businesses[].id` de `GET /api/businesses` |
| `procedureId` | Procedimento selecionado |
| `professionalId` | Profissional selecionado |
| `scheduledAt` | Horário retornado pela API e confirmado pelo usuário |

Nunca aceite IDs inventados pelo modelo. Todos os IDs devem vir da API ou do contexto autenticado.

## Fluxo conversacional recomendado

```text
Usuário pede agendamento
  → solicitar e validar código por e-mail
  → guardar o JWT da sessão
  → selecionar estabelecimento
  → buscar e selecionar procedimento
  → listar e selecionar profissional
  → perguntar a data desejada
  → consultar disponibilidade
  → usuário escolhe um horário retornado
  → chatbot resume e pede confirmação explícita
  → criar agendamento uma única vez
  → informar o ID confirmado pela API
```

O chatbot não deve afirmar que um horário está disponível antes da consulta, nem dizer que o agendamento foi concluído antes de receber sucesso da API.

## 1. Autenticar por código e obter o JWT

O fluxo indicado para o chatbot é o controller `PasswordlessController`. Ele funciona em duas etapas e não exige JWT para solicitar ou validar o código.

### 1.1 Solicitar código

```http
POST /api/passwordless/request
Content-Type: application/json

{
  "email": "cliente@exemplo.com"
}
```

O código possui seis dígitos, expira em 10 minutos e é enviado ao e-mail cadastrado. Por segurança, a API retorna uma mensagem neutra mesmo quando o e-mail não existe:

```json
{
  "message": "Se o seu e-mail estiver cadastrado, você receberá um código para fazer o login."
}
```

O chatbot deve pedir o código ao usuário sem confirmar se o endereço está cadastrado. Não registre nem repita o código na conversa depois da validação.

### 1.2 Trocar o código por JWT

```http
POST /api/passwordless/login
Content-Type: application/json

{
  "email": "cliente@exemplo.com",
  "code": "123456"
}
```

Resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>"
  }
}
```

O código é de uso único. Código inválido, expirado ou já utilizado deve ser tratado como falha de autenticação. Depois do sucesso, envie o JWT em todas as chamadas de perfil, procedimentos, profissionais, disponibilidade e agendamentos:

```http
Authorization: Bearer <jwt>
```

O login passwordless gera o mesmo tipo de JWT do login convencional. Se uma chamada autenticada retornar `401`, descarte o token e reinicie o fluxo passwordless; o endpoint `/api/auth/refresh` também existe, mas exige que o JWT atual ainda seja aceito pela API.

### Limitação atual: telefone ainda não está implementado

Nesta versão do backend, os dois comandos passwordless possuem somente `email`, o usuário é pesquisado por e-mail e o código é enviado por e-mail. Portanto, **o fluxo por telefone não está disponível no contrato atual**, mesmo que tenha sido previsto no produto.

Não envie `phone` para esses endpoints e não informe ao usuário que um SMS ou WhatsApp foi enviado. Para suportar telefone será necessário ampliar command, validator, repositório e serviço de entrega do código, preservando a resposta neutra contra enumeração de usuários.

## 2. Identificar o usuário

```http
GET /api/auth/profile
```

Resposta relevante:

```json
{
  "nameid": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "email": "cliente@exemplo.com",
  "unique_name": "Cliente"
}
```

Guarde `nameid` como `userId` durante a conversa. Se a API retornar `401`, interrompa o fluxo e solicite nova autenticação.

## 3. Listar e selecionar o estabelecimento

Depois da autenticação, liste os estabelecimentos disponíveis para o usuário:

```http
GET /api/businesses?pageNumber=1&pageSize=10&searchTerm=
Authorization: Bearer <jwt>
```

A resposta desse endpoint é um DTO direto, sem o envelope `data`:

```json
{
  "businesses": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Salão Central",
      "address": "Rua Exemplo, 100",
      "phone": "+5531999999999",
      "email": "contato@salao.example",
      "isActive": true,
      "userRole": "client"
    }
  ],
  "pagination": {
    "totalCount": 1,
    "pageSize": 10,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

Regras para o chatbot:

- apresente `name` e, quando útil, `address`; não mostre o GUID ao usuário;
- ofereça apenas estabelecimentos retornados pela API e com `isActive=true`;
- guarde o `id` escolhido como `businessId`;
- se houver muitos resultados, use `searchTerm` com o nome informado ou percorra `pagination.totalPages`;
- se não houver resultados, peça outro termo de busca;
- se houver uma única opção, ainda confirme com o usuário antes de avançar;
- ao trocar de estabelecimento, limpe procedimento, profissional, data e horário já selecionados.

A listagem de profissionais deve acontecer somente depois dessa escolha, usando o mesmo `businessId`. Isso impede que o bot combine um profissional de um estabelecimento com um procedimento de outro.

## 4. Buscar procedimentos

Para listar os procedimentos do estabelecimento:

```http
GET /api/procedures/business/{businessId}
```

Cada procedimento contém:

```json
{
  "id": "33333333-3333-3333-3333-333333333333",
  "name": "Corte de cabelo",
  "description": "Corte masculino ou feminino",
  "durationMinutes": 45,
  "price": 80.00,
  "businessId": "22222222-2222-2222-2222-222222222222"
}
```

Apresente ao usuário nome, duração e preço. Mantenha o `id` internamente. Se houver muitos resultados, apresente poucas opções por vez. Não altere o preço retornado pela API.

Para consultar novamente um procedimento conhecido, existe `GET /api/procedures/{procedureId}`. No código atual, essa rota utiliza a mesma consulta por negócio; portanto, prefira a listagem por `businessId` até esse contrato ser corrigido.

## 5. Listar e selecionar o profissional

```http
GET /api/businesses/{businessId}/professional
```

A resposta normalmente usa o envelope da aplicação; a coleção `user` fica em `data.user`:

```json
{
  "success": true,
  "data": {
    "user": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Ana"
    }
  ]
  }
}
```

Mostre o nome ao usuário e use o `id` retornado como `professionalId`. Não aceite um profissional que não esteja na lista do estabelecimento selecionado.

## 6. Consultar horários do profissional

Depois de conhecer `businessId`, `professionalId`, `procedureId` e a data desejada:

```http
GET /api/businesses/{businessId}/professional/{professionalId}/available/procedure/{procedureId}?date=2026-07-15
```

A data é obrigatória. A resposta normalmente contém `data.availableTimes`:

```json
{
  "success": true,
  "data": {
    "availableTimes": [
    "2026-07-15T09:00:00-03:00",
    "2026-07-15T10:30:00-03:00",
    "2026-07-15T14:00:00-03:00"
    ]
  }
}
```

Regras para o bot:

- ofereça somente valores presentes em `availableTimes`;
- exiba os horários no timezone do estabelecimento;
- mantenha o valor ISO original para enviar na criação;
- se a lista estiver vazia, peça outra data, profissional ou procedimento;
- imediatamente antes da criação, confirme data, hora, profissional, procedimento e preço;
- disponibilidade consultada não é reserva: conflitos ainda podem ocorrer até a confirmação.

## 7. Criar o agendamento

Somente após confirmação explícita do usuário:

```http
POST /api/appointment
```

Payload compatível com a implementação atual:

```json
{
  "appointment": {
    "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "userId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "businessId": "22222222-2222-2222-2222-222222222222",
    "professionalId": "11111111-1111-1111-1111-111111111111",
    "procedureId": "33333333-3333-3333-3333-333333333333",
    "scheduledAt": "2026-07-15T14:00:00-03:00",
    "isDelivery": false
  }
}
```

Resposta de sucesso esperada:

```json
{
  "success": true,
  "data": {
    "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
  }
}
```

Use `data.id` como confirmação. Não repita automaticamente o POST em timeout ou erro de rede, pois a primeira tentativa pode ter sido processada. Antes de tentar novamente, liste os agendamentos e verifique se já existe um registro equivalente.

### Atenção: contrato temporário de `appointment.id`

O mapper atual copia `appointment.id` para o usuário do comando de criação. Por isso, a integração atual precisa enviar em `appointment.id` o mesmo `userId` retornado em `nameid`. O handler depois atribui esse valor a `appointment.userId`.

Esse comportamento é ambíguo e tem impacto de segurança: o backend deveria obter o usuário exclusivamente do JWT e gerar o ID do agendamento. Trate-o como compatibilidade temporária e priorize a correção do backend. Depois da correção, remova `id` e `userId` do payload de criação.

## 8. Listar agendamentos

### Agendamentos do usuário autenticado

```http
GET /api/appointment/user
```

### Agendamentos do usuário em um estabelecimento

```http
GET /api/appointment/business/{businessId}/user
```

A resposta normalmente contém a coleção em `data.appointments`. Campos relevantes:

```json
{
  "success": true,
  "data": {
    "appointments": [
    {
      "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "professionalId": "11111111-1111-1111-1111-111111111111",
      "businessId": "22222222-2222-2222-2222-222222222222",
      "procedureId": "33333333-3333-3333-3333-333333333333",
      "scheduledAt": "2026-07-15T14:00:00-03:00",
      "paymentStatus": "pending",
      "finalPrice": 80.00
    }
    ]
  }
}
```

Ordene por `scheduledAt` no cliente. Por padrão, apresente primeiro os próximos agendamentos. Para enriquecer nomes ausentes, reutilize as listas de profissionais e procedimentos ou consulte os recursos correspondentes.

Também existem rotas administrativas/operacionais para listar por profissional ou negócio:

- `GET /api/appointment/professional/{professionalId}`
- `GET /api/appointment/business/{businessId}`

Não use essas rotas para um cliente final se ele não deve visualizar agendamentos de terceiros.

## Estado sugerido da conversa

```json
{
  "businessId": null,
  "procedureId": null,
  "professionalId": null,
  "requestedDate": null,
  "selectedTime": null,
  "awaitingConfirmation": false,
  "lastCreatedAppointmentId": null
}
```

Se o usuário trocar de estabelecimento, limpe `procedureId`, `professionalId`, `requestedDate` e `selectedTime`. Se trocar apenas procedimento, profissional ou data, limpe `selectedTime` e consulte a disponibilidade novamente.

## Regras para o prompt do chatbot

```text
Você é um assistente de agendamentos.
Nunca invente estabelecimentos, procedimentos, profissionais, preços ou horários.
Use somente dados retornados pelas ferramentas da API.
Antes de criar, confirme procedimento, profissional, data, hora e preço.
Crie apenas após uma confirmação explícita do usuário.
Nunca diga que foi agendado sem success=true e um ID retornado pela API.
Não repita automaticamente uma criação após timeout.
Não exponha JWT, IDs internos desnecessários ou dados de outros clientes.
Quando não houver horários, ofereça consultar outra data ou profissional.
```

## Tratamento de falhas

| Situação | Comportamento do chatbot |
|---|---|
| `401` | Solicitar nova autenticação e preservar apenas dados não sensíveis da intenção |
| `400` ou `success=false` | Explicar que a solicitação não pôde ser concluída e permitir nova escolha |
| Lista de procedimentos vazia | Informar que não há procedimentos disponíveis |
| Lista de profissionais vazia | Informar que não há profissionais disponíveis |
| `availableTimes` vazio | Oferecer outra data ou profissional |
| Conflito ao criar | Consultar disponibilidade novamente |
| Timeout no POST | Não repetir; verificar a lista de agendamentos primeiro |
| `500` | Informar indisponibilidade temporária sem revelar detalhes internos |

## Checklist de homologação

1. Login passwordless e `GET /api/auth/profile` funcionando.
2. Estabelecimentos listados e um `businessId` selecionado.
3. Procedimentos retornados para o estabelecimento escolhido.
4. Profissionais retornados para o mesmo estabelecimento.
5. Disponibilidade consultada com data e timezone corretos.
6. Criação feita somente após confirmação explícita.
7. Agendamento criado aparece em `GET /api/appointment/user`.
8. POST não é duplicado em timeout ou duplo clique.
9. O bot não mostra dados de outros clientes.
10. A correção do uso de `appointment.id` está registrada no backlog do backend.

