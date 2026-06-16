# Masteria — Documentação de Arquitetura e Engenharia

Esta documentação detalha a arquitetura técnica, estrutura do banco de dados, divisão de módulos e os fluxos de funcionamento da plataforma Masteria. O objetivo é servir de guia interno para futuras manutenções, debugs e expansões.

---

## 1. Visão Geral da Plataforma

O Masteria é uma plataforma full-stack focada em **Gestão de Leads (CRM), Atendimento Omnichannel, Inteligência Artificial e Automações**.

**Stack Tecnológica:**
- **Frontend / Framework:** Next.js 15 (App Router, Turbopack), React 18
- **UI / Estilização:** Tailwind CSS, Radix UI, Framer Motion
- **Backend (API):** Next.js Route Handlers (`/api`), com conexões diretas via adaptadores (ex: Meta, Evolution API)
- **Banco de Dados:** PostgreSQL hospedado via Supabase, gerenciado e tipado com **Drizzle ORM**
- **Workers / Background Jobs:** `BullMQ` com Redis (usando Node.js e processos standalone como `server.ts`)
- **Construção Visual de Fluxos:** `@xyflow/react` (React Flow) para construção de automações

---

## 2. Mapeamento do Banco de Dados (Schema)

O arquivo `src/lib/db/schema.ts` contém a definição completa. O banco usa relacionamentos fortemente amarrados com `uuid` e está particionado nos seguintes domínios:

### A. Domínio Core (Tenancy & Usuários)
- `companies`: Tabela central do multi-tenant (SaaS). Armazena dados da empresa, plano e limites.
- `company_quotas` / `company_financials`: Limites de disparo, contagem de IA tokens e finanças.
- `users` / `teams` / `users_to_teams`: Controle de acesso de atendentes, administradores e divisões em equipes (teams).
- `system_settings` / `company_credentials`: Chaves globais e por empresa de APIs (OpenAI, Gemini).

### B. Domínio de Contatos (Leads)
- `contacts`: Base unificada de clientes de uma empresa (Telefone, Email, Dados de Perfil VAK/Neurolinguístico).
- `tags` / `contact_lists` / `contacts_to_tags`: Estruturas de segmentação para disparos de campanhas e filtros.

### C. Domínio de Comunicação e Chat (Inbox)
- `connections`: Gerencia as instâncias de conexão com provedores externos (ex: Meta Graph API Oficial, Waha/Evolution). Controla status do QR Code, Tokens e Webhooks.
- `conversations`: Sessões de chat entre um `contact` e uma `company`. Tem status (NEW, ACTIVE, RESOLVED), dono (atendente) e pode estar sob controle da IA (`ai_active: boolean`).
- `messages`: O payload real das mensagens trafegadas (Texto, Áudio, Imagens, Documentos). Pode referenciar mensagens respondidas e reações (`message_reactions`).

### D. Domínio Kanban (CRM)
- `kanban_boards` / `kanban_leads`: Funis de venda personalizados por empresa. Os Leads transitam em colunas/etapas.
- `kanban_stage_personas`: Permite atrelar uma IA (Persona) específica a uma etapa do funil.

### E. Domínio de Inteligência Artificial (Agentes / Personas)
- `ai_personas`: Agentes configurados por empresa (prompt, temperatura, provider, agendamento de reuniões, follow-ups embutidos).
- `persona_prompt_sections`: Módulos de texto que injetam conhecimento fragmentado no prompt do agente.
- `persona_external_sources`: Integrações com conhecimento externo (Google Sheets, PDFs, CSVs) via RAG.

### F. Domínio de Automação & Campanhas
- `automation_rules`: Regras de gatilho (Trigger -> Conditions -> Actions). Ex: "Quando Lead entra no funil, adiciona tag X e manda Template Y".
- `automation_logs`: Registra o rastro de execução das automações.
- `campaigns`: Entidade para disparos em massa agendados.
- `message_templates`: Gerencia os templates pré-aprovados (da Meta API, por exemplo).
- `media_assets`: Armazenamento estruturado de mídias enviadas/recebidas (Google Cloud Storage / S3).

---

## 3. Estrutura de Diretórios e App Router

A interface e as rotas da API estão organizadas predominantemente nos seguintes caminhos:

### `/src/app`
- **`(dashboard)`**: Todo o painel onde o usuário navega (protegido por autenticação).
- **`(marketing)`** e **`(public)`**: Páginas externas e abertas.
- **`/api`**:
  - `/api/v1/...`: Endpoints de CRUD internos usados pelo Frontend via SWR/Fetch.
  - `/api/webhooks/...`: Rotas críticas e altamente responsivas para receber eventos assíncronos (Meta, Stripe, Evolution, etc.).

### `/src/components` (Domain-Driven UI)
Os componentes visuais estão muito bem separados por área de negócio, não apenas por "tipo de botão":
- `/atendimentos`: A interface principal de chat (`ActiveChat`, `MessageInput`, gerenciamento do `InboxController`).
- `/automations`: Componentes pesados envolvendo nós (nodes) e bordas (edges) do React Flow (`/editor-v4`).
- `/kanban`: O quadro de arrastar e soltar (DnD) para gerenciamento de CRM.
- `/ia`: Telas para construir o prompt e as fontes de dados dos Agentes.

### `/src/lib` e Serviços Compartilhados
- Adaptadores de integração de terceiros vivem aqui. Lógicas isoladas e instâncias do banco de dados (Drizzle client).

---

## 4. Fluxos e Padrões de Engenharia

### 4.1. Recebimento de Mensagens (O Caminho Crítico)
1. O provedor externo (Meta ou Evolution) dispara um evento para `/api/webhooks/[provider]`.
2. O webhook identifica a conexão correspondente em `connections`.
3. Processa/normaliza o evento em uma `conversation` e salva a `message`.
4. Dispara webhooks internos via Socket.IO ou invalidadores de cache (SWR) para atualizar o client (`/atendimentos`) instantaneamente.
5. Se `conversations.ai_active === true`, enfileira ou processa o job para a Persona correspondente (em `/ai`) gerar e responder à mensagem usando RAG e o Histórico.

### 4.2. Processamento Assíncrono (Workers)
Tarefas pesadas, como envio de Campanhas com milhares de leads, Importações de CSV, e certos processos de LLM são delegados ao **BullMQ** e executados através do `server.ts` / `worker-initializer`, evitando _timeouts_ nas Serverless Functions do Next.js.

### 4.3. Padrões de Regras do Frontend e Typescript
- Nunca usar `any` (exceto em APIs de terceiros não tipadas, documentando com `// external-api: untyped`).
- As buscas e consumo de estado no painel geralmente utilizam o **SWR** (padrão de cache local e revalidação), garantindo sincronia em tempo real e UX responsiva.
- **Tratamento de Erro:** As rotas `/api` sempre devem retornar códigos HTTP corretos e `{ error: "motivo real" }`, para que as falhas sejam geridas visualmente em Toasts/Modais no cliente.
- **UX Premium:** Aplicação intensa de classes utilitárias de opacidade, glassmorphism e cores dark mode baseadas em temas escalonados (`bg-zinc-900`, etc), além de animações refinadas do Framer Motion onde apropriado (evitados em listas grandes).

---

## 5. Como usar este Guia (Checklist para Modificações)

Ao interagir com o código para criar novas rotas ou componentes, utilize as seguintes premissas:

1. **Contexto Antes da Ação:**
   Use ferramentas como `grep_search` para rastrear dependências de um módulo (ex: `conversations`) antes de alterá-lo.
2. **Impacto no Banco de Dados:**
   Ao adicionar funcionalidades, adicione campos ao `schema.ts` e siga o fluxo com `db:generate` e `db:migrate` se necessário. Evite operações destrutivas.
3. **Padrão de UI:**
   Aproveite componentes do `/ui` em vez de criar elementos brutos. Mantenha os padrões visuais existentes (Radius, Padding, Cores Dark).
4. **Resiliência Anti-Regressão:**
   Testar fluxos primários (Enviar Mensagem, Adicionar ao Kanban, Ativar IA) sempre que tocar em `lib/` ou `hooks/` globais.

Esta arquitetura assegura que a plataforma Masteria esteja pronta para escalar, oferecendo uma ponte resiliente entre os provedores de chat, LLMs e o ambiente multi-tenant dos usuários.
