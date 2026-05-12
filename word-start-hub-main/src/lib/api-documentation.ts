// API Documentation Data - Organized by section
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  description: string;
  code: string;
  response?: string;
  notes?: string[];
}

export interface ApiSection {
  id: string;
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
}

export const getApiDocumentation = (projectUrl: string, anonKey: string, organizationId: string): ApiSection[] => [
  {
    id: 'queries',
    title: 'Queries',
    description: 'Endpoints para buscar dados do sistema',
    endpoints: [
      {
        id: 'get-chats',
        method: 'GET',
        path: '/functions/v1/chat-webhook',
        title: 'Listar Chats',
        description: 'Busque todos os chats ou filtre por telefone',
        code: `curl -X GET '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "uuid-do-chat",
      "phone": "558892161399",
      "wa_name": "Deivid iA",
      "wa_photo_url": "https://...",
      "last_message": "Boa tarde!",
      "agent_off": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "global_bot_enabled": true
}`
      },
      {
        id: 'get-chat-by-phone',
        method: 'GET',
        path: '/functions/v1/chat-webhook?phone={phone}',
        title: 'Buscar Chat por Telefone',
        description: 'Busque um chat específico pelo número de telefone',
        code: `curl -X GET '${projectUrl}/functions/v1/chat-webhook?phone=558892161399&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "abc123-uuid-do-chat",
      "phone": "558892161399",
      "wa_name": "Deivid iA",
      ...
    }
  ]
}`
      },
      {
        id: 'get-groups',
        method: 'GET',
        path: '/functions/v1/chat-webhook?is_group=true',
        title: 'Listar Grupos',
        description: 'Liste todos os grupos de WhatsApp',
        code: `curl -X GET '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}&is_group=true' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "uuid-do-grupo",
      "phone": "558892161399-group",
      "is_group": true,
      "group_name": "Grupo de Vendas",
      "participant_count": 15
    }
  ]
}`
      },
      {
        id: 'get-tags',
        method: 'GET',
        path: '/functions/v1/tags-webhook',
        title: 'Listar Tags',
        description: 'Busque todas as tags disponíveis',
        code: `curl -X GET '${projectUrl}/functions/v1/tags-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`
      },
      {
        id: 'get-chat-tags',
        method: 'GET',
        path: '/functions/v1/chat-tags-webhook?chat_id={id}',
        title: 'Listar Tags de um Chat',
        description: 'Busque as tags atribuídas a um chat específico',
        code: `curl -X GET '${projectUrl}/functions/v1/chat-tags-webhook?chat_id=uuid-do-chat&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`
      },
      {
        id: 'get-users',
        method: 'GET',
        path: '/rest/v1/profiles',
        title: 'Listar Usuários/Agentes',
        description: 'Liste todos os usuários disponíveis para atribuição',
        code: `curl -X GET '${projectUrl}/rest/v1/profiles?select=id,full_name,email' \\
  -H 'Authorization: Bearer ${anonKey}' \\
  -H 'apikey: ${anonKey}'`,
        response: `[
  {
    "id": "uuid-usuario-1",
    "full_name": "João Silva",
    "email": "joao@empresa.com"
  }
]`
      },
      {
        id: 'get-teams',
        method: 'GET',
        path: '/rest/v1/teams',
        title: 'Listar Equipes',
        description: 'Liste todas as equipes disponíveis',
        code: `curl -X GET '${projectUrl}/rest/v1/teams?select=id,name,description,active' \\
  -H 'Authorization: Bearer ${anonKey}' \\
  -H 'apikey: ${anonKey}'`,
        response: `[
  {
    "id": "uuid-equipe-1",
    "name": "Vendas",
    "active": true
  }
]`
      }
    ]
  },
  {
    id: 'message-history',
    title: 'Histórico de Mensagens',
    description: 'Endpoints para buscar histórico de mensagens de um lead',
    endpoints: [
      {
        id: 'get-messages',
        method: 'GET',
        path: '/functions/v1/messages-webhook?chat_id={id}',
        title: 'Buscar Mensagens por Chat ID',
        description: 'Busque mensagens de um chat específico pelo ID',
        code: `curl -X GET '${projectUrl}/functions/v1/messages-webhook?chat_id=uuid-do-chat&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "uuid-mensagem",
      "chat_id": "uuid-chat",
      "content": "Olá, preciso de ajuda",
      "message_type": "text",
      "is_from_user": false,
      "sender_name": "João Silva",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}`
      },
      {
        id: 'get-messages-by-phone',
        method: 'GET',
        path: '/functions/v1/messages-webhook?phone={phone}',
        title: 'Buscar Mensagens por Telefone',
        description: 'Busque mensagens de um lead pelo número de telefone. Ideal para n8n onde você tem o telefone mas não o chat_id.',
        code: `curl -X GET '${projectUrl}/functions/v1/messages-webhook?phone=554930906515&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "uuid-mensagem",
      "chat_id": "uuid-chat",
      "content": "Mensagem do lead",
      "message_type": "text",
      "is_from_user": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}`,
        notes: ['O telefone pode conter ou não o código do país', 'Caracteres não numéricos serão removidos automaticamente', 'Sistema resolve automaticamente o chat_id interno']
      },
      {
        id: 'get-messages-history-paginated',
        method: 'GET',
        path: '/functions/v1/messages-webhook?phone={phone}&limit={limit}&order={order}',
        title: 'Histórico Paginado (Últimas X mensagens)',
        description: 'Busque as últimas X mensagens de um lead com controle de ordenação. Perfeito para alimentar contexto em agentes de I.A.',
        code: `# Últimas 5 mensagens, mais recente primeiro
curl -X GET '${projectUrl}/functions/v1/messages-webhook?phone=554930906515&organization_id=${organizationId}&limit=5&order=desc' \\
  -H 'Content-Type: application/json'

# Últimas 10 mensagens em ordem cronológica
curl -X GET '${projectUrl}/functions/v1/messages-webhook?phone=554930906515&organization_id=${organizationId}&limit=10&order=asc' \\
  -H 'Content-Type: application/json'

# Também funciona com chat_id
curl -X GET '${projectUrl}/functions/v1/messages-webhook?chat_id=uuid-do-chat&organization_id=${organizationId}&limit=5&order=desc' \\
  -H 'Content-Type: application/json'`,
        response: `{
  "success": true,
  "data": [
    {
      "id": "uuid-mensagem",
      "chat_id": "uuid-chat",
      "content": "Olá, preciso de ajuda",
      "message_type": "text",
      "is_from_user": false,
      "sender_name": "João Silva",
      "created_at": "2024-01-15T10:30:00Z",
      "file_url": null,
      "file_name": null,
      "private": false,
      "is_follow_up": false,
      "external_message_id": "3EB0..."
    }
  ]
}`,
        notes: [
          'phone ou chat_id: identificador do lead (obrigatório um dos dois)',
          'limit: número máximo de mensagens (opcional, padrão: todas)',
          'order: "desc" para mais recente primeiro, "asc" para cronológico (padrão: asc)',
          'is_from_user: false = mensagem do LEAD',
          'is_from_user: true = mensagem do ATENDENTE/BOT',
          'private: true = nota interna (não enviada ao WhatsApp)',
          'is_follow_up: true = mensagem automática de follow-up'
        ]
      }
    ]
  },
  {
    id: 'mutations',
    title: 'Mutations',
    description: 'Endpoints para criar, atualizar e deletar dados',
    endpoints: [
      {
        id: 'create-chat',
        method: 'POST',
        path: '/functions/v1/chat-webhook',
        title: 'Criar Chat',
        description: 'Crie um novo chat/lead no sistema',
        code: `curl -X POST '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "+5511999999999",
    "wa_name": "João Silva",
    "last_message": "Olá!"
  }'`
      },
      {
        id: 'update-chat',
        method: 'PUT',
        path: '/functions/v1/chat-webhook',
        title: 'Atualizar Chat',
        description: 'Atualize os dados de um chat existente',
        code: `curl -X PUT '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "+5511999999999",
    "wa_name": "João Silva Atualizado",
    "last_message": "Nova mensagem"
  }'`
      },
      {
        id: 'toggle-bot',
        method: 'PATCH',
        path: '/functions/v1/chat-webhook',
        title: 'Toggle Bot',
        description: 'Ligue ou desligue o bot para um chat específico',
        code: `curl -X PATCH '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "5511999999999",
    "agent_off": true
  }'`,
        notes: ['agent_off: true = bot desligado', 'agent_off: false = bot ligado']
      },
      {
        id: 'delete-chat',
        method: 'DELETE',
        path: '/functions/v1/chat-webhook?phone={phone}',
        title: 'Deletar Chat',
        description: 'Remova um chat e todas as suas mensagens',
        code: `curl -X DELETE '${projectUrl}/functions/v1/chat-webhook?phone=%2B5511999999999&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`,
        notes: ['Ação irreversível', 'Remove todas as mensagens associadas']
      },
      {
        id: 'assign-to-user',
        method: 'PATCH',
        path: '/rest/v1/chats?id=eq.{chat_id}',
        title: 'Atribuir Chat a Usuário',
        description: 'Atribua um chat a um agente específico',
        code: `curl -X PATCH '${projectUrl}/rest/v1/chats?id=eq.uuid-do-chat' \\
  -H 'Authorization: Bearer ${anonKey}' \\
  -H 'Content-Type: application/json' \\
  -H 'apikey: ${anonKey}' \\
  -H 'Prefer: return=representation' \\
  -d '{
    "assigned_to": "uuid-do-usuario",
    "assigned_at": "2024-11-28T10:30:00Z"
  }'`
      },
      {
        id: 'assign-to-team',
        method: 'PATCH',
        path: '/rest/v1/chats?id=eq.{chat_id}',
        title: 'Atribuir Chat a Equipe',
        description: 'Atribua um chat a uma equipe específica',
        code: `curl -X PATCH '${projectUrl}/rest/v1/chats?id=eq.uuid-do-chat' \\
  -H 'Authorization: Bearer ${anonKey}' \\
  -H 'Content-Type: application/json' \\
  -H 'apikey: ${anonKey}' \\
  -H 'Prefer: return=representation' \\
  -d '{
    "team_id": "uuid-da-equipe",
    "assigned_at": "2024-11-28T10:30:00Z"
  }'`
      }
    ]
  },
  {
    id: 'messages',
    title: 'Mensagens',
    description: 'Endpoints para envio de mensagens (texto, áudio, imagem, PDF)',
    endpoints: [
      {
        id: 'send-text',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Texto',
        description: 'Envie uma mensagem de texto para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "content": "Olá! Como posso ajudar?",
    "message_type": "text",
    "is_from_user": true,
    "organization_id": "${organizationId}"
  }'`,
        notes: ['is_from_user: true = enviada por nós', 'is_from_user: false = recebida do lead']
      },
      {
        id: 'send-audio',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Áudio',
        description: 'Envie uma mensagem de áudio',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "message_type": "audio",
    "file_url": "https://storage.supabase.co/...",
    "file_name": "audio_123.mp3",
    "file_size": 45600,
    "is_from_user": false,
    "organization_id": "${organizationId}"
  }'`
      },
      {
        id: 'send-image',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Imagem',
        description: 'Envie uma imagem para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "message_type": "image",
    "file_url": "https://storage.supabase.co/...",
    "file_name": "foto.jpg",
    "file_size": 256000,
    "is_from_user": false,
    "organization_id": "${organizationId}"
  }'`
      },
      {
        id: 'send-pdf',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar PDF',
        description: 'Envie um documento PDF',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "message_type": "pdf",
    "file_url": "https://storage.supabase.co/...",
    "file_name": "catalogo.pdf",
    "file_size": 1048576,
    "is_from_user": false,
    "organization_id": "${organizationId}"
  }'`
      },
      {
        id: 'send-internal',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Mensagem Interna (Nota)',
        description: 'Envie uma nota privada visível apenas para a equipe',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "content": "Esta é uma nota interna",
    "message_type": "text",
    "is_from_user": true,
    "private": true,
    "organization_id": "${organizationId}"
  }'`,
        notes: ['Não aparece para o lead', 'Exibida com fundo amarelado na interface', 'Não dispara webhooks externos']
      },
      {
        id: 'send-contact',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Contato',
        description: 'Envie um cartão de contato para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "content": "{\\"display_name\\": \\"João Silva\\", \\"phone\\": \\"+5511999999999\\", \\"vcard\\": \\"BEGIN:VCARD...\\"}",
    "message_type": "contact",
    "is_from_user": true,
    "organization_id": "${organizationId}"
  }'`,
        response: `{
  "success": true,
  "message": {
    "id": "uuid-da-mensagem",
    "message_type": "contact"
  }
}`,
        notes: [
          'O campo content deve ser um JSON stringificado',
          'Estrutura do content: { display_name, phone, vcard (opcional) }',
          'O webhook sent receberá contact_data com os dados parseados'
        ]
      },
      {
        id: 'send-location',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Localização',
        description: 'Envie uma localização para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "content": "{\\"latitude\\": -23.5505, \\"longitude\\": -46.6333, \\"name\\": \\"Escritório\\", \\"address\\": \\"Av. Paulista, 1000\\"}",
    "message_type": "location",
    "is_from_user": true,
    "organization_id": "${organizationId}"
  }'`,
        response: `{
  "success": true,
  "message": {
    "id": "uuid-da-mensagem",
    "message_type": "location"
  }
}`,
        notes: [
          'O campo content deve ser um JSON stringificado',
          'Estrutura: { latitude (number), longitude (number), name (opcional), address (opcional) }',
          'O webhook sent receberá location_data com os dados parseados'
        ]
      },
      {
        id: 'send-pix',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar PIX',
        description: 'Envie dados de pagamento PIX para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "content": "{\\"key\\": \\"+5511999999999\\", \\"key_type\\": \\"PHONE\\", \\"merchant_name\\": \\"Loja ABC\\", \\"reference_id\\": \\"Pedido123\\"}",
    "message_type": "pix",
    "is_from_user": true,
    "organization_id": "${organizationId}"
  }'`,
        response: `{
  "success": true,
  "message": {
    "id": "uuid-da-mensagem",
    "message_type": "pix"
  }
}`,
        notes: [
          'O campo content deve ser um JSON stringificado',
          'Estrutura: { key, key_type (CPF/CNPJ/EMAIL/PHONE/EVP), merchant_name, reference_id (opcional) }',
          'O webhook sent receberá pix_data com os dados parseados'
        ]
      },
      {
        id: 'send-video',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Enviar Vídeo',
        description: 'Envie um vídeo para um chat',
        code: `curl -X POST '${projectUrl}/functions/v1/messages-webhook' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "message_type": "video",
    "file_url": "https://storage.supabase.co/...",
    "file_name": "video.mp4",
    "file_size": 10485760,
    "is_from_user": true,
    "organization_id": "${organizationId}"
  }'`,
        response: `{
  "success": true,
  "message": {
    "id": "uuid-da-mensagem",
    "message_type": "video",
    "file_url": "https://..."
  }
}`,
        notes: [
          'O vídeo deve estar hospedado em uma URL pública',
          'file_size em bytes (máx recomendado: 50MB)',
          'Formatos suportados: MP4, WebM, MOV'
        ]
      }
    ]
  },
  {
    id: 'tags',
    title: 'Tags',
    description: 'Gerenciamento de tags e atribuições a chats',
    endpoints: [
      {
        id: 'create-tag',
        method: 'POST',
        path: '/functions/v1/tags-webhook',
        title: 'Criar Tag',
        description: 'Crie uma nova tag no sistema',
        code: `curl -X POST '${projectUrl}/functions/v1/tags-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Lead Quente",
    "color": "#10B981",
    "icon": "Flame"
  }'`
      },
      {
        id: 'assign-tag',
        method: 'POST',
        path: '/functions/v1/chat-tags-webhook',
        title: 'Atribuir Tag ao Chat',
        description: 'Associe uma tag a um chat específico',
        code: `curl -X POST '${projectUrl}/functions/v1/chat-tags-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "chat_id": "uuid-do-chat",
    "tag_id": "uuid-da-tag"
  }'`
      },
      {
        id: 'remove-tag',
        method: 'DELETE',
        path: '/functions/v1/chat-tags-webhook',
        title: 'Remover Tag do Chat',
        description: 'Remova uma tag de um chat',
        code: `curl -X DELETE '${projectUrl}/functions/v1/chat-tags-webhook?chat_id=uuid-do-chat&tag_id=uuid-da-tag&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`
      },
      {
        id: 'delete-tag',
        method: 'DELETE',
        path: '/functions/v1/tags-webhook?id={id}',
        title: 'Deletar Tag',
        description: 'Remova uma tag do sistema',
        code: `curl -X DELETE '${projectUrl}/functions/v1/tags-webhook?id=uuid-da-tag&organization_id=${organizationId}' \\
  -H 'Content-Type: application/json'`
      }
    ]
  },
  {
    id: 'human-assist',
    title: 'Escalar',
    description: 'Endpoints para escalar conversas para atendimento humano',
    endpoints: [
      {
        id: 'request-human',
        method: 'PATCH',
        path: '/functions/v1/chat-webhook',
        title: 'Solicitar Atendimento Humano',
        description: 'Ativa o indicador amarelo de atendimento humano necessário',
        code: `curl -X PATCH '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "558892161399",
    "request_human": true
  }'`,
        response: `{
  "success": true,
  "message": "Atendimento humano solicitado",
  "data": {
    "human_requested_at": "2024-01-15T10:30:00Z"
  }
}`,
        notes: [
          'Exibe bolinha amarela na lista de conversas',
          'Use quando o bot não consegue responder',
          'Permanece até um agente responder ou ser removido'
        ]
      },
      {
        id: 'remove-human-request',
        method: 'PATCH',
        path: '/functions/v1/chat-webhook',
        title: 'Remover Indicador de Atendimento',
        description: 'Remove o indicador de atendimento humano pendente',
        code: `curl -X PATCH '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "phone": "558892161399",
    "request_human": false
  }'`
      }
    ]
  },
  {
    id: 'webhooks',
    title: 'Webhooks',
    description: 'Configuração de webhooks para integração com Z-API e Evolution API',
    endpoints: [
      {
        id: 'zapi-webhook',
        method: 'POST',
        path: '/functions/v1/z-api-webhook',
        title: 'Webhook Z-API',
        description: 'Endpoint para receber mensagens do Z-API',
        code: `URL para configurar no Z-API:
${projectUrl}/functions/v1/z-api-webhook?organization_id=${organizationId}

// Payload de exemplo (texto):
{
  "phone": "558892161399",
  "chatName": "Nome do Lead",
  "senderName": "Nome Completo",
  "photo": "https://pps.whatsapp.net/...",
  "fromMe": false,
  "text": {
    "message": "Boa tarde!"
  },
  "momment": 1763406113000
}`
      },
      {
        id: 'zapi-image',
        method: 'POST',
        path: '/functions/v1/z-api-webhook',
        title: 'Payload Imagem (Z-API)',
        description: 'Formato de payload para mensagens de imagem',
        code: `{
  "phone": "558892161399",
  "chatName": "Nome do Lead",
  "fromMe": false,
  "image": {
    "imageUrl": "https://url-da-imagem.jpg",
    "caption": "Legenda opcional",
    "mimeType": "image/jpeg"
  },
  "momment": 1763406113000
}`
      },
      {
        id: 'zapi-audio',
        method: 'POST',
        path: '/functions/v1/z-api-webhook',
        title: 'Payload Áudio (Z-API)',
        description: 'Formato de payload para mensagens de áudio',
        code: `{
  "phone": "558892161399",
  "chatName": "Nome do Lead",
  "fromMe": false,
  "audio": {
    "audioUrl": "https://url-do-audio.mp3",
    "mimeType": "audio/mpeg"
  },
  "momment": 1763406113000
}`
      },
      {
        id: 'zapi-document',
        method: 'POST',
        path: '/functions/v1/z-api-webhook',
        title: 'Payload Documento (Z-API)',
        description: 'Formato de payload para documentos PDF',
        code: `{
  "phone": "558892161399",
  "chatName": "Nome do Lead",
  "fromMe": false,
  "document": {
    "documentUrl": "https://url-do-documento.pdf",
    "fileName": "documento.pdf",
    "mimeType": "application/pdf",
    "fileSize": 1048576
  },
  "momment": 1763406113000
}`
      }
    ]
  },
  {
    id: 'n8n-nodes',
    title: 'Nodes n8n (Copiar/Colar)',
    description: 'Nodes prontos para copiar e colar no n8n para enviar mensagens via HTTP Request',
    endpoints: [
      {
        id: 'n8n-send-text',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Node: Enviar Texto',
        description: 'Node n8n pronto para enviar mensagem de texto',
        code: `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${projectUrl}/functions/v1/messages-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"chat_id\\": \\"{{ $json.chat_id }}\\",\\n  \\"content\\": \\"{{ $json.mensagem }}\\",\\n  \\"message_type\\": \\"text\\",\\n  \\"is_from_user\\": true,\\n  \\"organization_id\\": \\"${organizationId}\\"\\n}",
        "options": {}
      },
      "name": "Enviar Texto",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [300, 300]
    }
  ],
  "connections": {}
}`,
        notes: [
          'Substitua {{ $json.chat_id }} pelo ID do chat',
          'Substitua {{ $json.mensagem }} pelo conteúdo da mensagem',
          'O webhook sent será disparado automaticamente'
        ]
      },
      {
        id: 'n8n-send-contact',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Node: Enviar Contato',
        description: 'Node n8n pronto para enviar cartão de contato',
        code: `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${projectUrl}/functions/v1/messages-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"chat_id\\": \\"{{ $json.chat_id }}\\",\\n  \\"content\\": \\"{\\\\\\"display_name\\\\\\": \\\\\\"{{ $json.nome_contato }}\\\\\\", \\\\\\"phone\\\\\\": \\\\\\"{{ $json.telefone_contato }}\\\\\\"}\\",\\n  \\"message_type\\": \\"contact\\",\\n  \\"is_from_user\\": true,\\n  \\"organization_id\\": \\"${organizationId}\\"\\n}",
        "options": {}
      },
      "name": "Enviar Contato",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [300, 300]
    }
  ],
  "connections": {}
}`,
        notes: [
          'O campo content é um JSON stringificado com display_name e phone',
          'O webhook sent receberá contact_data com os dados parseados'
        ]
      },
      {
        id: 'n8n-send-location',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Node: Enviar Localização',
        description: 'Node n8n pronto para enviar localização',
        code: `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${projectUrl}/functions/v1/messages-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"chat_id\\": \\"{{ $json.chat_id }}\\",\\n  \\"content\\": \\"{\\\\\\"latitude\\\\\\": {{ $json.latitude }}, \\\\\\"longitude\\\\\\": {{ $json.longitude }}, \\\\\\"name\\\\\\": \\\\\\"{{ $json.nome_local }}\\\\\\", \\\\\\"address\\\\\\": \\\\\\"{{ $json.endereco }}\\\\\\"}\\",\\n  \\"message_type\\": \\"location\\",\\n  \\"is_from_user\\": true,\\n  \\"organization_id\\": \\"${organizationId}\\"\\n}",
        "options": {}
      },
      "name": "Enviar Localização",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [300, 300]
    }
  ],
  "connections": {}
}`,
        notes: [
          'latitude e longitude são números (sem aspas)',
          'name e address são opcionais',
          'O webhook sent receberá location_data com os dados parseados'
        ]
      },
      {
        id: 'n8n-send-pix',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Node: Enviar PIX',
        description: 'Node n8n pronto para enviar dados de pagamento PIX',
        code: `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${projectUrl}/functions/v1/messages-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"chat_id\\": \\"{{ $json.chat_id }}\\",\\n  \\"content\\": \\"{\\\\\\"key\\\\\\": \\\\\\"{{ $json.chave_pix }}\\\\\\", \\\\\\"key_type\\\\\\": \\\\\\"{{ $json.tipo_chave }}\\\\\\", \\\\\\"merchant_name\\\\\\": \\\\\\"{{ $json.nome_beneficiario }}\\\\\\", \\\\\\"reference_id\\\\\\": \\\\\\"{{ $json.referencia }}\\\\\\"}\\",\\n  \\"message_type\\": \\"pix\\",\\n  \\"is_from_user\\": true,\\n  \\"organization_id\\": \\"${organizationId}\\"\\n}",
        "options": {}
      },
      "name": "Enviar PIX",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [300, 300]
    }
  ],
  "connections": {}
}`,
        notes: [
          'key_type pode ser: CPF, CNPJ, EMAIL, PHONE, EVP',
          'reference_id é opcional',
          'O webhook sent receberá pix_data com os dados parseados'
        ]
      },
      {
        id: 'n8n-send-video',
        method: 'POST',
        path: '/functions/v1/messages-webhook',
        title: 'Node: Enviar Vídeo',
        description: 'Node n8n pronto para enviar vídeo (URL pública)',
        code: `{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "${projectUrl}/functions/v1/messages-webhook",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\\n  \\"chat_id\\": \\"{{ $json.chat_id }}\\",\\n  \\"message_type\\": \\"video\\",\\n  \\"file_url\\": \\"{{ $json.url_video }}\\",\\n  \\"file_name\\": \\"{{ $json.nome_arquivo }}\\",\\n  \\"file_size\\": {{ $json.tamanho_bytes }},\\n  \\"is_from_user\\": true,\\n  \\"organization_id\\": \\"${organizationId}\\"\\n}",
        "options": {}
      },
      "name": "Enviar Video",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [300, 300]
    }
  ],
  "connections": {}
}`,
        notes: [
          'O vídeo deve estar hospedado em URL pública acessível',
          'file_size em bytes',
          'Formatos suportados: MP4, WebM, MOV'
        ]
      }
    ]
  },
  {
    id: 'evolution-mapping',
    title: 'Mapeamento Evolution API',
    description: 'Como transformar o payload do webhook sent para enviar ao Evolution API',
    endpoints: [
      {
        id: 'evolution-location',
        method: 'POST',
        path: '/message/sendLocation/{instance}',
        title: 'Enviar Localização (Evolution)',
        description: 'Transforme o payload do webhook sent para o formato Evolution API',
        code: `// No n8n, após receber o webhook sent do tipo "location":

// Payload recebido do sistema:
{
  "messageId": "uuid",
  "phone": "5511999999999",
  "number": "5511999999999",
  "messageType": "location",
  "location_data": {
    "latitude": -23.5505,
    "longitude": -46.6333,
    "name": "Escritório",
    "address": "Av. Paulista, 1000"
  }
}

// Transformar para Evolution API:
curl -X POST "https://SEU_HOST/message/sendLocation/SUA_INSTANCIA" \\
  -H "apikey: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "{{ $json.number }}",
    "latitude": {{ $json.location_data.latitude }},
    "longitude": {{ $json.location_data.longitude }},
    "name": "{{ $json.location_data.name }}",
    "address": "{{ $json.location_data.address }}"
  }'`
      },
      {
        id: 'evolution-contact',
        method: 'POST',
        path: '/message/sendContact/{instance}',
        title: 'Enviar Contato (Evolution)',
        description: 'Transforme o payload do webhook sent para o formato Evolution API',
        code: `// No n8n, após receber o webhook sent do tipo "contact":

// Payload recebido do sistema:
{
  "messageId": "uuid",
  "phone": "5511999999999",
  "number": "5511999999999",
  "messageType": "contact",
  "contact_data": {
    "display_name": "João Silva",
    "phone": "5511888888888",
    "vcard": "BEGIN:VCARD..."
  }
}

// Transformar para Evolution API:
curl -X POST "https://SEU_HOST/message/sendContact/SUA_INSTANCIA" \\
  -H "apikey: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "{{ $json.number }}",
    "contact": {
      "fullName": "{{ $json.contact_data.display_name }}",
      "phoneNumber": "{{ $json.contact_data.phone }}"
    }
  }'`
      },
      {
        id: 'evolution-pix',
        method: 'POST',
        path: '/message/sendText/{instance}',
        title: 'Enviar PIX como Texto (Evolution)',
        description: 'Evolution não tem endpoint PIX nativo, enviar como texto',
        code: `// No n8n, após receber o webhook sent do tipo "pix":

// Payload recebido do sistema:
{
  "messageId": "uuid",
  "phone": "5511999999999",
  "number": "5511999999999",
  "messageType": "pix",
  "pix_data": {
    "key": "+5511999999999",
    "key_type": "PHONE",
    "merchant_name": "Loja ABC",
    "reference_id": "Pedido123"
  }
}

// Transformar para Evolution API (como texto):
curl -X POST "https://SEU_HOST/message/sendText/SUA_INSTANCIA" \\
  -H "apikey: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "{{ $json.number }}",
    "text": "💰 Dados para pagamento PIX\\n\\nChave: {{ $json.pix_data.key }}\\nTipo: {{ $json.pix_data.key_type }}\\nBeneficiário: {{ $json.pix_data.merchant_name }}\\nReferência: {{ $json.pix_data.reference_id }}"
  }'`
      },
      {
        id: 'evolution-video',
        method: 'POST',
        path: '/message/sendMedia/{instance}',
        title: 'Enviar Vídeo (Evolution)',
        description: 'Transforme o payload do webhook sent para o formato Evolution API',
        code: `// No n8n, após receber o webhook sent do tipo "video":

// Payload recebido do sistema:
{
  "messageId": "uuid",
  "phone": "5511999999999",
  "number": "5511999999999",
  "messageType": "video",
  "fileUrl": "https://storage.supabase.co/.../video.mp4",
  "fileName": "video.mp4",
  "fileSize": 10485760
}

// Transformar para Evolution API:
curl -X POST "https://SEU_HOST/message/sendMedia/SUA_INSTANCIA" \\
  -H "apikey: SUA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "{{ $json.number }}",
    "mediatype": "video",
    "media": "{{ $json.fileUrl }}",
    "fileName": "{{ $json.fileName }}"
  }'`
      }
    ]
  },
  {
    id: 'realtime',
    title: 'Realtime',
    description: 'Escute mudanças em tempo real usando Supabase Realtime',
    endpoints: [
      {
        id: 'realtime-chats',
        method: 'GET',
        path: 'supabase.channel()',
        title: 'Escutar Mudanças',
        description: 'Receba notificações em tempo real quando dados mudarem',
        code: `import { supabase } from '@/integrations/supabase/client';

const channel = supabase
  .channel('chats-changes')
  .on(
    'postgres_changes',
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'chats'
    },
    (payload) => {
      console.log('Mudança:', payload);
      // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
      // payload.new: novo registro
      // payload.old: registro anterior
    }
  )
  .subscribe();

// Para cancelar a inscrição:
supabase.removeChannel(channel);`
      },
      {
        id: 'realtime-messages',
        method: 'GET',
        path: 'supabase.channel()',
        title: 'Escutar Novas Mensagens',
        description: 'Receba notificações de novas mensagens',
        code: `const channel = supabase
  .channel('messages-changes')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'chat_id=eq.uuid-do-chat'
    },
    (payload) => {
      console.log('Nova mensagem:', payload.new);
    }
  )
  .subscribe();`
      }
    ]
  }
];

export const getWebhookUrls = (projectUrl: string, organizationId: string) => ({
  zapi: `${projectUrl}/functions/v1/z-api-webhook?organization_id=${organizationId}`,
  chat: `${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}`,
  messages: `${projectUrl}/functions/v1/messages-webhook`,
  tags: `${projectUrl}/functions/v1/tags-webhook?organization_id=${organizationId}`,
  chatTags: `${projectUrl}/functions/v1/chat-tags-webhook?organization_id=${organizationId}`,
});

export const getSchemaInfo = () => `// Estrutura das tabelas principais

chats {
  id: uuid (PK)
  phone: text
  wa_name: text
  wa_photo_url: text
  last_message: text
  agent_off: boolean
  is_group: boolean
  group_name: text
  assigned_to: uuid (FK → profiles)
  team_id: uuid (FK → teams)
  human_requested_at: timestamp
  organization_id: uuid
  created_at: timestamp
  updated_at: timestamp
}

messages {
  id: uuid (PK)
  chat_id: uuid (FK → chats)
  content: text
  message_type: text
  is_from_user: boolean
  sender_name: text
  file_url: text
  private: boolean
  organization_id: uuid
  created_at: timestamp
}

tags {
  id: uuid (PK)
  name: text
  color: text
  icon: text
  order_position: integer
  organization_id: uuid
}

chat_tags {
  id: uuid (PK)
  chat_id: uuid (FK → chats)
  tag_id: uuid (FK → tags)
  assigned_at: timestamp
  organization_id: uuid
}

profiles {
  id: uuid (PK)
  email: text
  full_name: text
  avatar_url: text
  organization_id: uuid
}

teams {
  id: uuid (PK)
  name: text
  description: text
  color: text
  active: boolean
  organization_id: uuid
}`;
