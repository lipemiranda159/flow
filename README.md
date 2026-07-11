# WhatsApp Flow MVP

API TypeScript orientada por JSON para executar fluxos conversacionais. O MVP recebe uma mensagem, preserva a posição da conversa e devolve ações independentes do provedor.

**Suporta múltiplas plataformas** (WhatsApp, Telegram, etc.) através de um sistema escalável de adapters que normalizam webhooks reais de cada plataforma.

## Quick Start - Desenvolvimento Local

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Teste com:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/messages/process `
  -Headers @{ Authorization = 'Bearer local-development-key' } `
  -ContentType 'application/json' `
  -Body '{"externalUserId":"5511999999999","channel":"whatsapp","message":"oi"}'
```

Resposta: `Olá! Qual é o seu nome?`

## Status das Plataformas

| Plataforma | Input | Output | Status |
|-----------|-------|--------|--------|
| **WhatsApp** | ✅ Webhook Meta real | ✅ Formato Meta API | ✅ Pronto |
| **Telegram** | ✅ Update do Telegram | ✅ Formato Telegram Bot API | ✅ Pronto |
| **Adicionar nova** | ⚡ Template disponível | ⚡ Template disponível | 🚀 Fácil |

## Rotas recomendadas

Para produção, use rotas dedicadas por plataforma no mesmo deploy:

- `POST /api/webhooks/whatsapp`
- `POST /api/webhooks/telegram`

A rota `POST /api/messages/process` continua disponível como endpoint genérico para testes e integrações controladas. Nela, a API usa `channel` explícito ou tenta inferir a plataforma a partir do payload nativo.

## Testar a conversa

### WhatsApp

⚠️ Para testes locais, use o formato simplificado abaixo. Para webhooks REAIS da Meta, veja [REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md).

Primeira chamada:

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/messages/process `
  -Headers @{ Authorization = 'Bearer local-development-key' } `
  -ContentType 'application/json' `
  -Body '{"externalUserId":"5511999999999","channel":"whatsapp","message":"oi"}'
```

Resposta esperada: `Olá! Qual é o seu nome?`

Envie outra chamada com o mesmo `externalUserId` e `"message":"Maria"`. A resposta será `Prazer em conhecer você, Maria!`.

### Telegram

⚠️ Para testes locais, use o formato simplificado. Para webhooks REAIS do Telegram, veja [REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md).

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/messages/process `
  -Headers @{ Authorization = 'Bearer local-development-key' } `
  -ContentType 'application/json' `
  -Body '{
    "channel": "telegram",
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 111222333,
        "is_bot": false,
        "first_name": "João"
      },
      "chat": { "id": 111222333, "type": "private" },
      "date": 1234567890,
      "text": "oi"
    }
  }'
```

A resposta será convertida automaticamente para o formato esperado por Telegram.

## Contrato

### Format Específico por Plataforma

Cada plataforma envia seu webhook em formato NATIVO:

**WhatsApp** (webhook da Meta):
```json
{ "entry": [{ "changes": [{ "value": { "messages": [...], "contacts": [...] } }] }] }
```

**Telegram** (update do Telegram):
```json
{ "update_id": 123, "message": { "from": {...}, "text": "...", "chat": {...} } }
```

A API automaticamente:
1. **Detecta o channel** do webhook
2. **Carrega o adapter específico** (WhatsApp ou Telegram)
3. **Normaliza** o payload nativo para formato interno
4. **Processa a conversa** (agnóstico de plataforma)
5. **Desnormaliza a resposta** para formato específico da plataforma

Em produção, prefira as rotas dedicadas para evitar ambiguidade e manter o contrato do webhook explícito.

### Fluxo Completo

```
┌─ Usuário WhatsApp ────────┬─ Usuário Telegram ─────┐
│  envia mensagem           │  envia mensagem        │
└──────────────┬────────────┴───────────────┬────────┘
               │                            │
         ┌─────▼──────────┬────────────────▼──────┐
         │  Meta Webhook  │  Telegram Update     │
         └─────┬──────────┴────────────────┬──────┘
               │                            │
         ┌─────▼──────────────────────────▼─────┐
         │  POST /api/messages/process           │
         └─────┬──────────────────────────────────┘
               │
         ┌─────▼──────────────────────┐
         │  AdapterFactory.getAdapter │
         │  (detecta channel)          │
         └─────┬──────────────┬────────┘
         ┌─────▼──────┐  ┌──▼──────────┐
         │ WhatsApp   │  │  Telegram   │
         │ Adapter    │  │  Adapter    │
         └─────┬──────┘  └──┬──────────┘
               │             │
         ┌─────▼─────────────▼────────┐
         │  normalize() → interno     │
         └─────┬──────────────────────┘
               │
         ┌─────▼──────────────────────┐
         │  processMessage() (core)   │
         │  - engine                  │
         │  - conversation repo       │
         └─────┬──────────────────────┘
               │
         ┌─────▼──────────────────────┐
         │  denormalize() → nativo    │
         └─────┬──────────────────────┘
         ┌─────▼──────┐  ┌──▼──────────┐
         │ Meta format│  │  Telegram   │
         │ { text: }  │  │  format     │
         └─────┬──────┘  └──┬──────────┘
               │             │
         ┌─────▼──────────────▼──────┐
         │  Response JSON             │
         └─────┬────────┬─────────────┘
         ┌─────▼──┐  ┌──▼────────┐
         │POST to │  │POST to    │
         │Meta    │  │Telegram   │
         └─────┬──┘  └──┬────────┘
               │         │
         ┌─────▼────────▼────┐
         │ Usuário recebe    │
         │ mensagem resposta │
         └───────────────────┘
```

## Próximos Passos para Produção

Para integrar com webhooks REAIS:

1. **Configure os webhooks** nas plataformas:
   - [WhatsApp Cloud API Console](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
   - [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook)

2. **A plataforma** pode chamar diretamente a rota dedicada ou seu backend pode repassar para ela:
      - WhatsApp: `/api/webhooks/whatsapp`
      - Telegram: `/api/webhooks/telegram`

3. **Sua API** (esta) processa e retorna a resposta no formato nativo

4. **Seu backend** faz um POST para a API da plataforma com a resposta

Veja [REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md) para arquitetura completa e exemplos de código.

## Verificação

```powershell
npm run build
npm test
```

## Documentação Completa

- **[PLATFORM_ADAPTERS.md](PLATFORM_ADAPTERS.md)** - Arquitetura de adapters, como estender para novas plataformas
- **[REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md)** - Exemplos reais de webhooks do WhatsApp e Telegram
- **[BACKEND_INTEGRATION_EXAMPLE.md](BACKEND_INTEGRATION_EXAMPLE.md)** - Como integrar com seu backend (código Express pronto)

## Limites atuais do MVP

- Há um único fluxo de exemplo compilado no código.
- Persistência em memória é somente para desenvolvimento/testes.
- A migration inicial deve ser aplicada manualmente no Neon.
- Adapters convertem formato, mas você precisa gerenciar tokens/credenciais das plataformas no seu backend.
- Próximas entregas: Idempotência por ID externo, subflows `call`/`return`, HTTP declarativo e gestão de versões.


