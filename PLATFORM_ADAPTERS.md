# Platform Adapters - Exemplos Reais

## ⚠️ IMPORTANTE

A API **recebe e responde no formato NATIVO de cada plataforma**, não em um formato genérico.

- **WhatsApp**: Recebe webhook completo da Meta, responde no formato Meta API
- **Telegram**: Recebe update completo do Telegram, responde no formato Telegram Bot API

Veja [REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md) para exemplos práticos de integração.

---

## Arquitetura

```
PlatformRequest (webhook NATIVO da plataforma)
    ↓
PlatformAdapter.normalizeRequest()
    ↓
ProcessMessage (core agnóstico)
    ↓
PlatformAdapter.denormalizeResponse()
    ↓
PlatformResponse (formato NATIVO da plataforma)
```

---

## WhatsApp (Meta Cloud API)

### Request REAL (webhook da Meta)

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "5511999999999",
                "id": "wamid.xxx",
                "type": "text",
                "text": { "body": "Olá" }
              }
            ],
            "contacts": [
              {
                "profile": { "name": "João" },
                "wa_id": "5511999999999"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

### Response (formato para enviar à Meta API)

```json
{
  "messaging_product": "whatsapp",
  "to": "5511999999999",
  "type": "text",
  "text": {
    "body": "Olá! Qual é o seu nome?"
  },
  "_internal": {
    "conversationId": "uuid",
    "status": "active",
    "actions": [...],
    "executedSteps": 1
  }
}
```

---

## Telegram (Bot API)

### Request REAL (update do Telegram)

```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "date": 1720710633,
    "chat": {
      "id": 111222333,
      "type": "private"
    },
    "from": {
      "id": 111222333,
      "is_bot": false,
      "first_name": "João"
    },
    "text": "Olá"
  }
}
```

### Response (formato para enviar à Telegram Bot API)

```json
{
  "method": "sendMessage",
  "chat_id": 111222333,
  "text": "Olá! Qual é o seu nome?",
  "parse_mode": "HTML",
  "_internal": {
    "conversationId": "uuid",
    "status": "active",
    "actions": [...],
    "executedSteps": 1
  }
}
```

---

## Como Adicionar Uma Nova Plataforma

### 1. Criar um novo adapter (exemplo: Instagram)

```typescript
// src/infrastructure/adapters/instagram-adapter.ts
import type { PlatformAdapter, PlatformRequest, PlatformResponse, NormalizedMessage, NormalizedActions } from "./platform-adapter.js";

export class InstagramAdapter implements PlatformAdapter {
  channel = "instagram";

  normalizeRequest(request: PlatformRequest): NormalizedMessage {
    // Extrair do webhook real do Instagram
    const entry = (request.entry as any[])?.[0];
    const messaging = entry?.messaging?.[0];
    
    if (!messaging) throw new Error("Instagram messaging ausente");
    
    return {
      externalUserId: messaging.sender.id,
      message: messaging.message?.text,
      metadata: {
        instagramSenderId: messaging.sender.id,
        instagramMessageId: messaging.message?.mid,
        rawWebhook: request
      }
    };
  }

  denormalizeResponse(response: NormalizedActions): PlatformResponse {
    // Resposta no formato esperado pela Instagram API
    return {
      recipient: {
        id: undefined  // Será preenchido com o sender.id do webhook
      },
      message: {
        text: response.actions
          .filter(a => a.type === "message")
          .map(a => a.text)
          .join("\n")
      },
      _internal: {
        conversationId: response.conversationId,
        status: response.status,
        actions: response.actions,
        executedSteps: response.executedSteps
      }
    };
  }
}
```

### 2. Registrar o adapter

No arquivo de inicialização (ex: `src/server.ts` ou num arquivo de setup):

```typescript
import { AdapterFactory } from "./src/infrastructure/adapters/adapter-factory.js";
import { InstagramAdapter } from "./src/infrastructure/adapters/instagram-adapter.js";

AdapterFactory.registerAdapter(new InstagramAdapter());
```

### 3. Seu endpoint agora funciona com Instagram:

```bash
# O webhook real do Instagram vem aqui
POST /api/messages/process
{
  "entry": [
    {
      "messaging": [
        {
          "sender": { "id": "123456789" },
          "message": { "mid": "msg_xxx", "text": "Olá" }
        }
      ]
    }
  ]
}
```

---

## Padrão para Cada Adapter

```typescript
export class XxxAdapter implements PlatformAdapter {
  channel = "xxx";

  normalizeRequest(request: PlatformRequest): NormalizedMessage {
    // 1. Extrair do webhook nativo
    // 2. Validar campos obrigatórios
    // 3. Retornar formato interno normalizado
    // 4. Guardar informações no metadata para desnormalizar depois
  }

  denormalizeResponse(response: NormalizedActions): PlatformResponse {
    // 1. Extrair as ações processadas
    // 2. Mapear para formato esperado pela plataforma
    // 3. Retornar no formato correto para enviar à API da plataforma
  }
}
```

---

## Benefícios da Arquitetura

✅ **Realista**: Processa webhooks reais das plataformas  
✅ **Extensível**: Adicionar nova plataforma sem modificar o core  
✅ **Testável**: Cada adapter pode ser testado isoladamente  
✅ **Mantível**: Lógica específica de plataforma isolada  
✅ **Agnóstico**: Core da lógica independente de plataforma  

---

## Limites Atuais

- Adapters lidam com conversão de formato, mas você ainda precisa:
  - Configurar webhooks em cada plataforma
  - Fazer o segundo POST para a API da plataforma com a resposta
  - Gerenciar tokens/credenciais de cada plataforma
- Ver [REAL_WEBHOOK_EXAMPLES.md](REAL_WEBHOOK_EXAMPLES.md) para arquitetura completa

