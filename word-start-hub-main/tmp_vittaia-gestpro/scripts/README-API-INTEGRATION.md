# Integração API - N8N HTTP Requests

Documentação completa dos endpoints disponíveis para integração com N8N via HTTP Request.

## Configuração Base

**Base URL:** `https://rzboyyfptjjjwhqmwlok.supabase.co/functions/v1`

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Ym95eWZwdGpqandocW13bG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjAzMDQsImV4cCI6MjA3NzQzNjMwNH0.9_BjKlQiLllq50LCU1DcPs93CL1SfydV9K4uo-vYQ3k"
}
```

---

## 1. Buscar Conversa (Chat)

**Endpoint:** `GET /chat-webhook?phone={phone}`

**Descrição:** Verifica se uma conversa existe pelo número de telefone.

**Parâmetros:**
- `phone` (query, opcional): Número de telefone (ex: 5511999999999). Se não informado, retorna todos os chats.

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "phone": "5511999999999",
      "wa_name": "Nome do Lead",
      "wa_photo_url": "url",
      "last_message": "última mensagem",
      "agent_off": false,
      "created_at": "2025-10-31T10:00:00Z",
      "updated_at": "2025-10-31T15:30:00Z"
    }
  ],
  "global_bot_enabled": true
}
```

**Resposta quando não encontrado:**
```json
{
  "success": true,
  "data": []
}
```

---

## 2. Buscar Etiquetas de uma Conversa

**Endpoint:** `GET /chat-tags-webhook?chat_id={chat_id}`

**Descrição:** Retorna todas as etiquetas atribuídas a uma conversa.

**Parâmetros:**
- `chat_id` (query, obrigatório): ID do chat

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "tag_id": "uuid",
      "assigned_at": "2025-10-31T10:00:00Z",
      "tags": {
        "id": "uuid",
        "name": "Lead Qualificado",
        "color": "#3B82F6",
        "icon": "Tag"
      }
    }
  ]
}
```

---

## 3. Verificar Status do Robô

**Endpoint:** `GET /chat-webhook?phone={phone}`

**Descrição:** Verifica se o robô está ativo ou desligado para aquela conversa.

**Campo na resposta:** `agent_off`
- `false` = Robô ativo
- `true` = Robô desligado

---

## 4. Criar Novo Lead (Chat)

**Endpoint:** `POST /chat-webhook`

**Descrição:** Cria uma nova conversa/lead no sistema.

**Body:**
```json
{
  "phone": "5511999999999",
  "wa_name": "Nome do Lead",
  "wa_photo_url": "https://...",
  "last_message": "Olá, gostaria de mais informações",
  "agent_off": false
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-do-chat-criado",
    "phone": "5511999999999",
    "wa_name": "Nome do Lead",
    "created_at": "2025-10-31T15:45:00Z",
    "updated_at": "2025-10-31T15:45:00Z"
  }
}
```

---

## 5. Atualizar Dados do Lead

**Endpoint:** `PUT /chat-webhook`

**Descrição:** Atualiza informações do lead (nome, foto, última mensagem) SEM modificar o status do robô.

**Body:**
```json
{
  "phone": "5511999999999",
  "wa_name": "Nome Atualizado",
  "wa_photo_url": "https://nova-foto.jpg",
  "last_message": "Nova mensagem recebida"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "5511999999999",
    "wa_name": "Nome Atualizado",
    "updated_at": "2025-10-31T16:00:00Z"
  }
}
```

---

## 6. Atualizar Status do Robô

**Endpoint:** `PATCH /chat-webhook`

**Descrição:** Atualiza SOMENTE o status do robô (ativo/desligado).

**Body:**
```json
{
  "phone": "5511999999999",
  "agent_off": true
}
```

`agent_off: true` = desligar robô  
`agent_off: false` = ligar robô

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "5511999999999",
    "agent_off": true,
    "updated_at": "2025-10-31T16:05:00Z"
  }
}
```

---

## 7. Atribuir Etiqueta a um Lead

**Endpoint:** `POST /chat-tags-webhook`

**Descrição:** Adiciona uma etiqueta a uma conversa.

**Body:**
```json
{
  "chat_id": "uuid-do-chat",
  "tag_id": "uuid-da-tag"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "chat_id": "uuid-do-chat",
    "tag_id": "uuid-da-tag",
    "assigned_at": "2025-10-31T16:10:00Z"
  }
}
```

---

## 8. Remover Etiqueta de um Lead

**Endpoint:** `DELETE /chat-tags-webhook?chat_id={chat_id}&tag_id={tag_id}`

**Descrição:** Remove uma etiqueta de uma conversa.

**Parâmetros:**
- `chat_id` (query, obrigatório)
- `tag_id` (query, obrigatório)

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Tag removida do chat com sucesso"
}
```

---

## 9. Listar Todas as Etiquetas

**Endpoint:** `GET /tags-webhook`

**Descrição:** Lista todas as etiquetas disponíveis no sistema.

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Lead Qualificado",
      "color": "#3B82F6",
      "icon": "Tag",
      "order_position": 1,
      "created_at": "2025-10-30T10:00:00Z"
    }
  ]
}
```

---

## 10. Listar Usuários/Agentes

**Endpoint:** `GET /rest/v1/profiles`

**Descrição:** Lista todos os usuários/agentes disponíveis no sistema.

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_ANON_KEY",
  "apikey": "SEU_ANON_KEY"
}
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid-usuario-1",
    "full_name": "João Silva",
    "email": "joao@empresa.com"
  },
  {
    "id": "uuid-usuario-2",
    "full_name": "Maria Santos",
    "email": "maria@empresa.com"
  }
]
```

---

## 11. Listar Equipes

**Endpoint:** `GET /rest/v1/teams`

**Descrição:** Lista todas as equipes disponíveis no sistema.

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_ANON_KEY",
  "apikey": "SEU_ANON_KEY"
}
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid-equipe-1",
    "name": "Vendas",
    "description": "Equipe de vendas",
    "active": true
  },
  {
    "id": "uuid-equipe-2",
    "name": "Suporte",
    "description": "Equipe de suporte",
    "active": true
  }
]
```

---

## 12. Atribuir Lead a Usuário/Agente

**Endpoint:** `PATCH /rest/v1/chats?id=eq.{chat_id}`

**Descrição:** Atribui uma conversa a um usuário específico. Gera automaticamente uma mensagem de sistema no chat.

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_ANON_KEY",
  "apikey": "SEU_ANON_KEY",
  "Prefer": "return=representation"
}
```

**Body:**
```json
{
  "assigned_to": "uuid-do-usuario",
  "assigned_at": "2024-11-28T10:30:00Z"
}
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid-do-chat",
    "phone": "5511999999999",
    "assigned_to": "uuid-do-usuario",
    "assigned_at": "2024-11-28T10:30:00Z",
    "team_id": null
  }
]
```

---

## 13. Atribuir Lead a Equipe

**Endpoint:** `PATCH /rest/v1/chats?id=eq.{chat_id}`

**Descrição:** Atribui uma conversa a uma equipe. Gera automaticamente uma mensagem de sistema no chat.

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_ANON_KEY",
  "apikey": "SEU_ANON_KEY",
  "Prefer": "return=representation"
}
```

**Body:**
```json
{
  "team_id": "uuid-da-equipe",
  "assigned_at": "2024-11-28T10:30:00Z"
}
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid-do-chat",
    "phone": "5511999999999",
    "assigned_to": null,
    "team_id": "uuid-da-equipe",
    "assigned_at": "2024-11-28T10:30:00Z"
  }
]
```

---

## 14. Remover Atribuição de Lead

**Endpoint:** `PATCH /rest/v1/chats?id=eq.{chat_id}`

**Descrição:** Remove qualquer atribuição (usuário ou equipe) de uma conversa. Gera automaticamente uma mensagem de sistema no chat.

**Headers Obrigatórios:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer SEU_ANON_KEY",
  "apikey": "SEU_ANON_KEY",
  "Prefer": "return=representation"
}
```

**Body:**
```json
{
  "assigned_to": null,
  "team_id": null,
  "assigned_at": null
}
```

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "uuid-do-chat",
    "phone": "5511999999999",
    "assigned_to": null,
    "team_id": null,
    "assigned_at": null
  }
]
```

---

## 15. Enviar Mensagem Interna (Nota Privada)

**Endpoint:** `POST /functions/v1/messages-webhook`

**Descrição:** Envia uma mensagem interna que só a equipe pode ver. NÃO é enviada ao lead e não dispara webhooks externos.

**Body:**
```json
{
  "chat_id": "uuid-do-chat",
  "content": "Esta é uma nota interna que só a equipe vê",
  "message_type": "text",
  "is_from_user": true,
  "private": true
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message_id": "uuid-da-mensagem"
}
```

**Observações Importantes:**
- `private: true` = mensagem interna (fundo amarelado na interface)
- `private: false` = mensagem normal (enviada ao lead)
- Mensagens internas NÃO disparam webhooks externos
- Visíveis para toda a equipe no histórico do chat

---

## 16. Enviar Card de Contato

**Endpoint:** `POST /functions/v1/messages-webhook`

**Descrição:** Envia um cartão de contato para o lead.

**Body:**
```json
{
  "chat_id": "uuid-do-chat",
  "content": "{\"display_name\":\"João Silva\",\"phone\":\"+5511999999999\",\"vcard\":\"BEGIN:VCARD\\nVERSION:3.0\\nN:;João Silva;;;\\nFN:João Silva\\nTEL;type=CELL;type=VOICE:+5511999999999\\nEND:VCARD\"}",
  "message_type": "contact",
  "is_from_user": true,
  "private": false
}
```

**Campos do content (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| display_name | string | Sim | Nome do contato |
| phone | string | Sim | Telefone do contato |
| vcard | string | Não | VCard completo (opcional) |

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message_id": "uuid-da-mensagem"
}
```

---

## 17. Enviar Localização

**Endpoint:** `POST /functions/v1/messages-webhook`

**Descrição:** Envia uma localização (coordenadas) para o lead.

**Body:**
```json
{
  "chat_id": "uuid-do-chat",
  "content": "{\"latitude\":-23.5505,\"longitude\":-46.6333,\"name\":\"Escritório Central\",\"address\":\"Av. Paulista, 1000 - São Paulo\"}",
  "message_type": "location",
  "is_from_user": true,
  "private": false
}
```

**Campos do content (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| latitude | number | Sim | Latitude da localização |
| longitude | number | Sim | Longitude da localização |
| name | string | Não | Nome do local |
| address | string | Não | Endereço do local |

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message_id": "uuid-da-mensagem"
}
```

---

## 18. Enviar Dados PIX

**Endpoint:** `POST /functions/v1/messages-webhook`

**Descrição:** Envia dados de pagamento PIX para o lead.

**Body:**
```json
{
  "chat_id": "uuid-do-chat",
  "content": "{\"key\":\"+5511999999999\",\"key_type\":\"PHONE\",\"merchant_name\":\"Empresa LTDA\",\"reference_id\":\"Pedido #123\"}",
  "message_type": "pix",
  "is_from_user": true,
  "private": false
}
```

**Campos do content (JSON):**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| key | string | Sim | Chave PIX |
| key_type | string | Sim | Tipo da chave: CPF, CNPJ, EMAIL, PHONE, EVP |
| merchant_name | string | Sim | Nome do beneficiário |
| reference_id | string | Não | Referência do pagamento |

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message_id": "uuid-da-mensagem"
}
```

---

## Recebendo Dados Especiais via Webhook

Quando o sistema recebe mensagens especiais do WhatsApp, o webhook de recebimento envia os dados estruturados:

### Card de Contato Recebido
```json
{
  "id": "uuid",
  "numero": "5511999999999",
  "tipo": "contact",
  "from-me": false,
  "chat_id": "uuid",
  "contact_data": {
    "display_name": "João Silva",
    "phone": "+5511999999999",
    "vcard": "BEGIN:VCARD..."
  },
  "created_at": "2025-01-13T10:00:00Z"
}
```

### Localização Recebida
```json
{
  "id": "uuid",
  "numero": "5511999999999",
  "tipo": "location",
  "from-me": false,
  "chat_id": "uuid",
  "location_data": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "Escritório",
    "address": "Av. Paulista, 1000"
  },
  "created_at": "2025-01-13T10:00:00Z"
}
```

### PIX Recebido
```json
{
  "id": "uuid",
  "numero": "5511999999999",
  "tipo": "pix",
  "from-me": false,
  "chat_id": "uuid",
  "pix_data": {
    "key": "+5511999999999",
    "key_type": "PHONE",
    "merchant_name": "Pagamentos",
    "reference_id": "ABC123"
  },
  "created_at": "2025-01-13T10:00:00Z"
}
```

---

## Histórico de Ações

Todas as ações importantes são registradas com timestamps:

### Tabela `chats`
- `created_at`: Data de criação do chat
- `updated_at`: Última atualização

### Tabela `chat_tags`
- `assigned_at`: Quando a tag foi atribuída

### Tabela `chat_tags_history`
- `assigned_at`: Quando a tag foi atribuída
- `removed_at`: Quando a tag foi removida

### Tabela `transactions`
- `created_at`: Data da transação

### Tabela `follow_up_webhook_log`
- `webhook_sent_at`: Quando o webhook foi enviado

### Tabela `lead_follow_up_tracking`
- `created_at`: Quando o lead entrou no follow-up
- `updated_at`: Última atualização do tracking

---

## Casos de Uso Práticos

### Atribuição de Leads

**Cenário 1: Distribuição automática de leads por equipe**
```
1. Lead entra via webhook Z-API
2. n8n identifica região/produto do lead
3. GET /rest/v1/teams para listar equipes
4. PATCH /rest/v1/chats para atribuir à equipe correta
5. Sistema cria mensagem de sistema no chat
```

**Cenário 2: Atribuição manual a agente específico**
```
1. GET /rest/v1/profiles para listar agentes disponíveis
2. PATCH /rest/v1/chats com assigned_to = uuid do agente
3. Sistema cria mensagem de sistema informando a atribuição
```

### Mensagens Internas

**Cenário 1: Passar contexto entre agentes**
```
POST /functions/v1/messages-webhook
{
  "chat_id": "uuid",
  "content": "Cliente já recebeu proposta de R$ 5.000. Aguardando retorno até sexta.",
  "message_type": "text",
  "is_from_user": true,
  "private": true
}
```

**Cenário 2: Alertas internos**
```
POST /functions/v1/messages-webhook
{
  "chat_id": "uuid",
  "content": "⚠️ CLIENTE VIP - Priorizar atendimento",
  "message_type": "text",
  "is_from_user": true,
  "private": true
}
```

### Integração Completa

**Fluxo completo de atendimento automatizado:**
```
1. Webhook Z-API recebe mensagem → Cria/atualiza chat
2. Sistema identifica intenção → Adiciona tag apropriada
3. Tag dispara follow-up automático → Envia mensagens programadas
4. Lead responde → Sistema detecta resposta
5. n8n atribui lead a agente → GET /profiles + PATCH /chats
6. Agente recebe notificação → Mensagem de sistema aparece no chat
7. Agente adiciona nota interna → POST /messages-webhook com private=true
8. Lead converte → Sistema adiciona tag final
```

---

## Configuração de Análises

### Taxa de Conversão

Configurada em: **Configurar Análises → Taxa de Conversão**

**Como funciona:**
1. **Etiqueta Inicial**: Define quando um lead entra no funil (ex: "Lead Qualificado")
2. **Etiqueta Final**: Define quando foi convertido (ex: "Cliente")

**Cálculo:**
```
Taxa = (Leads com Tag Final / Leads com Tag Inicial) × 100
```

**Exemplo:**
- 100 leads com "Lead Qualificado"
- 25 leads com "Cliente"
- Taxa de Conversão: **25%**

### Ciclo de Vendas

Configurado em: **Configurar Análises → Ciclo de Vendas**

**Como funciona:**
1. **Etiqueta Inicial**: Marca o início do processo (ex: "Negociação")
2. **Etiqueta Final**: Marca o fechamento (ex: "Cliente")

**Cálculo:**
```
Ciclo = Tempo médio entre Tag Inicial e Tag Final
```

**Exemplo:**
- Lead 1: "Negociação" (01/11) → "Cliente" (05/11) = 4 dias
- Lead 2: "Negociação" (02/11) → "Cliente" (09/11) = 7 dias
- Ciclo Médio: **5.5 dias**

**⚠️ Importante:**
- Usa `chat_tags_history` para calcular os intervalos
- Apenas leads com AMBAS as tags são contados
- As datas vêm do campo `assigned_at`
