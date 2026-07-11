# Integrações Reais com Webhooks

Este documento explica como integrar a API com webhooks REAIS de WhatsApp e Telegram.

---

## WhatsApp Cloud API (Meta)

### 1. Webhook que você recebe da Meta

Quando um usuário manda mensagem no WhatsApp, a Meta envia um webhook assim:

```json
{
  "entry": [
    {
      "id": "XXXXXXX",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5511999999999",
              "phone_number_id": "102099999999999"
            },
            "contacts": [
              {
                "profile": {
                  "name": "João Silva"
                },
                "wa_id": "5511999999999"
              }
            ],
            "messages": [
              {
                "from": "5511999999999",
                "id": "wamid.HBEUGVlQdjVFAgkqAqq6dYcKyXI",
                "timestamp": "1720710633",
                "type": "text",
                "text": {
                  "body": "Olá, tudo bem?"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### 2. Enviar para sua API

Você simplesmente faz um POST passando o webhook COMPLETO:

```powershell
$body = @{
  entry = @(
    @{
      changes = @(
        @{
          value = @{
            messaging_product = "whatsapp"
            messages = @(
              @{
                from = "5511999999999"
                id = "wamid.xxx"
                type = "text"
                text = @{ body = "Olá" }
              }
            )
            contacts = @(
              @{
                profile = @{ name = "João" }
                wa_id = "5511999999999"
              }
            )
          }
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/api/messages/process `
  -Headers @{ Authorization = 'Bearer local-development-key' } `
  -ContentType 'application/json' `
  -Body $body
```

### 3. Resposta que você recebe

```json
{
  "messaging_product": "whatsapp",
  "to": null,
  "type": "text",
  "text": {
    "body": "Olá! Qual é o seu nome?"
  },
  "_internal": {
    "conversationId": "uuid-xxx",
    "status": "active",
    "actions": [...],
    "executedSteps": 1
  }
}
```

### 4. Enviar a resposta DE VOLTA ao usuário

Agora seu backend faz um POST para a Meta API:

```bash
curl -X POST "https://graph.instagram.com/v18.0/{phone_number_id}/messages" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5511999999999",
    "type": "text",
    "text": {
      "body": "Olá! Qual é o seu nome?"
    }
  }'
```

### Fluxo Completo

```
[Usuário WhatsApp]
        ↓ (envia mensagem)
[Meta Webhook] → [Sua API /api/messages/process]
        ↓
[Adapter WhatsApp normaliza]
        ↓
[Conversa é processada]
        ↓
[Adapter WhatsApp desnormaliza resposta]
        ↓
[Seu backend recebe resposta]
        ↓
[Seu backend envia para Meta API]
        ↓
[Usuário recebe mensagem]
```

---

## Telegram Bot API

### 1. Webhook que você recebe do Telegram

Quando um usuário manda mensagem no Telegram, o bot recebe um webhook assim:

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 42,
    "date": 1720710633,
    "chat": {
      "id": 111222333,
      "first_name": "João",
      "username": "joao_silva",
      "type": "private"
    },
    "from": {
      "id": 111222333,
      "is_bot": false,
      "first_name": "João",
      "username": "joao_silva",
      "language_code": "pt-BR"
    },
    "text": "Olá, tudo bem?"
  }
}
```

### 2. Enviar para sua API

```bash
curl -X POST http://localhost:3000/api/messages/process \
  -H "Authorization: Bearer local-development-key" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "telegram",
    "update_id": 123456789,
    "message": {
      "message_id": 42,
      "date": 1720710633,
      "chat": {
        "id": 111222333,
        "first_name": "João",
        "type": "private"
      },
      "from": {
        "id": 111222333,
        "is_bot": false,
        "first_name": "João"
      },
      "text": "Olá, tudo bem?"
    }
  }'
```

### 3. Resposta que você recebe

```json
{
  "method": "sendMessage",
  "chat_id": null,
  "text": "Olá! Qual é o seu nome?",
  "parse_mode": "HTML",
  "_internal": {
    "conversationId": "uuid-xxx",
    "status": "active",
    "actions": [...]
  }
}
```

### 4. Enviar a resposta DE VOLTA ao usuário

Seu backend faz um POST para a Telegram Bot API:

```bash
curl -X POST https://api.telegram.org/bot{BOT_TOKEN}/sendMessage \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": 111222333,
    "text": "Olá! Qual é o seu nome?"
  }'
```

### Fluxo Completo

```
[Usuário Telegram]
        ↓ (envia mensagem)
[Telegram Update Webhook] → [Seu Bot recebe]
        ↓
[Você envia para /api/messages/process]
        ↓
[Adapter Telegram normaliza]
        ↓
[Conversa é processada]
        ↓
[Adapter Telegram desnormaliza resposta]
        ↓
[Seu backend recebe resposta]
        ↓
[Seu backend envia para Telegram Bot API]
        ↓
[Usuário recebe mensagem]
```

---

## Arquitetura no Seu Backend

Seu backend precisará fazer isso:

```typescript
// 1. Receber webhook de qualquer plataforma
app.post('/api/messages/process', async (req, res) => {
  const webhook = req.body;
  
  // 2. Enviar para nossa API
  const response = await fetch('http://seu-servidor/api/messages/process', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sua-chave',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(webhook)
  });
  
  const result = await response.json();
  
  // 3. Extrair dados do resultado
  const { _internal, method, text, chat_id, to, ...platformResponse } = result;
  
  // 4. Enviar para a plataforma
  if (result.method === 'sendMessage') {
    // Telegram
    await sendTelegramMessage(
      _internal.metadata.telegramChatId,
      text
    );
  } else if (result.messaging_product === 'whatsapp') {
    // WhatsApp
    await sendWhatsAppMessage(
      to,
      result.text.body
    );
  }
});
```

---

## Resumo

| Aspecto | WhatsApp | Telegram |
|--------|----------|----------|
| **Webhook recebido** | `entry[0].changes[0].value.messages[0]` | `message` |
| **Campo de usuário** | `messages[0].from` (string) | `message.from.id` (number) |
| **Campo de texto** | `messages[0].text.body` | `message.text` |
| **Tipo de adaptação** | Extrai de estrutura complexa | Extrai de estrutura simples |
| **Resposta esperada** | Meta API format | Telegram Bot API format |
| **Como enviar resposta** | `POST /v18.0/{phone_number_id}/messages` | `POST /bot{TOKEN}/sendMessage` |

---

## Próximos Passos

1. Configure os webhooks na plataforma (WhatsApp Cloud Console, Telegram Bot API)
2. Seu backend recebe o webhook
3. Envia para nossa API em `/api/messages/process`
4. Recebe a resposta normalizada
5. Envia de volta para a plataforma no formato correto
