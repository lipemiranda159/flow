# Exemplo: Backend Integrado com WhatsApp Flow

Este documento mostra como um backend real (Express/Node) se integra com a WhatsApp Flow API.

---

## Setup Básico (Express)

```typescript
import express from 'express';

const app = express();
app.use(express.json());

// Variáveis de ambiente necessárias
const WHATSAPP_FLOW_API = process.env.WHATSAPP_FLOW_API || 'http://localhost:3000';
const WHATSAPP_FLOW_KEY = process.env.WHATSAPP_FLOW_KEY || 'local-development-key';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

app.listen(3001, () => {
  console.log('Backend integrado rodando em :3001');
});
```

---

## Webhook do WhatsApp

### 1. Endpoint que recebe o webhook da Meta

```typescript
// POST /webhook/whatsapp
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    // Validar token da Meta (eles enviam um X-Hub-Signature)
    const signature = req.headers['x-hub-signature-256'];
    if (!validateMetaSignature(req.body, signature)) {
      return res.status(403).json({ error: 'Signature inválida' });
    }

    // Webhooks da Meta podem ser de vários tipos, filtrar apenas messages
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== 'messages') {
      return res.status(200).json({ received: true });
    }

    // Enviar o webhook COMPLETO para nossa API
    const flowResponse = await fetch(`${WHATSAPP_FLOW_API}/api/messages/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_FLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (!flowResponse.ok) {
      throw new Error(`Flow API error: ${flowResponse.statusText}`);
    }

    const result = await flowResponse.json();

    // Agora enviar a resposta DE VOLTA para o usuário via Meta API
    await sendWhatsAppMessage(
      result.to,
      result.text.body
    );

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

// Função auxiliar: enviar mensagem via Meta API
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  const response = await fetch(
    `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Meta API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}
```

### 2. Callback de verificação (Meta exige isso)

```typescript
// GET /webhook/whatsapp (callback de verificação)
app.get('/webhook/whatsapp', (req, res) => {
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Token inválido' });
  }
});
```

---

## Webhook do Telegram

### 1. Endpoint que recebe o webhook do Telegram

```typescript
// POST /webhook/telegram
app.post('/webhook/telegram', async (req, res) => {
  try {
    const update = req.body;

    // Filtrar apenas mensagens de texto
    if (!update.message?.text) {
      return res.status(200).json({ ok: true });
    }

    // Enviar o update COMPLETO para nossa API
    const flowResponse = await fetch(`${WHATSAPP_FLOW_API}/api/messages/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_FLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: 'telegram',
        ...update
      })
    });

    if (!flowResponse.ok) {
      throw new Error(`Flow API error: ${flowResponse.statusText}`);
    }

    const result = await flowResponse.json();

    // Enviar a resposta DE VOLTA para o usuário via Telegram Bot API
    await sendTelegramMessage(
      result.chat_id || update.message.chat.id,
      result.text
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro ao processar webhook Telegram:', error);
    res.status(200).json({ ok: true }); // Sempre responder 200 ao Telegram
  }
});

// Função auxiliar: enviar mensagem via Telegram Bot API
async function sendTelegramMessage(chatId: number, message: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}
```

### 2. Configurar webhook no Telegram

```bash
# Após deploy, configure o webhook no Telegram:
curl -X POST https://api.telegram.org/bot{BOT_TOKEN}/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-dominio.com/webhook/telegram",
    "allowed_updates": ["message"]
  }'
```

---

## Variáveis de Ambiente

```bash
# .env
WHATSAPP_FLOW_API=http://localhost:3000
WHATSAPP_FLOW_KEY=sua-chave-api
TELEGRAM_BOT_TOKEN=seu_bot_token
WHATSAPP_API_TOKEN=seu_token_meta
WHATSAPP_PHONE_ID=seu_phone_id
WEBHOOK_VERIFY_TOKEN=seu_token_verificacao
```

---

## Fluxo Completo na Prática

### WhatsApp

```
1. [Usuário envia mensagem no WhatsApp]
   ↓
2. [Meta envia webhook para seu backend] 
   POST /webhook/whatsapp
   ↓
3. [Seu backend envia para nossa API]
   POST http://localhost:3000/api/messages/process
   ↓
4. [Nossa API normaliza, processa, desnormaliza]
   ← Response em formato Meta API
   ↓
5. [Seu backend extrai texto e envia para Meta]
   POST https://graph.instagram.com/v18.0/{phone_number_id}/messages
   ↓
6. [Usuário recebe resposta no WhatsApp]
```

### Telegram

```
1. [Usuário envia mensagem no Telegram]
   ↓
2. [Telegram envia update para seu webhook]
   POST /webhook/telegram
   ↓
3. [Seu backend envia para nossa API]
   POST http://localhost:3000/api/messages/process
   ↓
4. [Nossa API normaliza, processa, desnormaliza]
   ← Response em formato Telegram Bot API
   ↓
5. [Seu backend extrai chat_id e texto, envia para Telegram]
   POST https://api.telegram.org/bot{TOKEN}/sendMessage
   ↓
6. [Usuário recebe resposta no Telegram]
```

---

## Validação de Assinaturas

### Meta (WhatsApp)

```typescript
import crypto from 'crypto';

function validateMetaSignature(body: any, signature: string) {
  if (!signature) return false;

  const [alg, hash] = signature.split('=');
  if (alg !== 'sha256') return false;

  const expectedHash = crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET || '')
    .update(JSON.stringify(body))
    .digest('hex');

  return hash === expectedHash;
}
```

### Telegram

Telegram usa um `secret_token` opcional que você configura e valida:

```typescript
function validateTelegramSignature(token: string) {
  return token === process.env.TELEGRAM_SECRET_TOKEN;
}

app.post('/webhook/telegram', (req, res) => {
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (!validateTelegramSignature(secretToken)) {
    return res.status(403).json({ error: 'Signature inválida' });
  }
  // ... processar webhook
});
```

---

## Tratamento de Erros

```typescript
// Classe para erros de integração
class IntegrationError extends Error {
  constructor(
    public platform: 'whatsapp' | 'telegram' | 'flow',
    public originalError: Error
  ) {
    super(`${platform} error: ${originalError.message}`);
  }
}

// Middleware de erro
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof IntegrationError) {
    console.error(`[${err.platform}]`, err.originalError);
    // Enviar para logging/monitoring
    return res.status(500).json({
      error: 'Erro ao processar mensagem',
      platform: err.platform
    });
  }
  next(err);
});
```

---

## Checklist de Produção

- [ ] Variáveis de ambiente configuradas
- [ ] Webhooks registrados nas plataformas (Meta + Telegram)
- [ ] HTTPS configurado (exigido pelas plataformas)
- [ ] Validação de assinaturas implementada
- [ ] Logging e monitoramento configurados
- [ ] Tratamento de timeouts (Flow API pode demorar)
- [ ] Rate limiting para webhooks
- [ ] Fila de mensagens para garantir entrega (recomendado: Bull, RabbitMQ)
- [ ] Health checks nos endpoints
- [ ] Testes de integração end-to-end

---

## Estrutura de Diretórios Recomendada

```
backend/
├── src/
│   ├── webhooks/
│   │   ├── whatsapp.ts
│   │   ├── telegram.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── flow-client.ts
│   │   ├── whatsapp-api.ts
│   │   └── telegram-api.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── signatures.ts
│   └── server.ts
├── .env.example
└── package.json
```
