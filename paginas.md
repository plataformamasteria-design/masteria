# Documentação Funcional e Estrutura de Interface (Front-end) - MasterIA

> [!IMPORTANT]
> **Status:** Ficha Técnica Detalhada (UI/UX e Roteamento)
> **Escopo:** Mapeamento Extensivo das Páginas, Funcionalidades, Lógica de Renderização e Interações de Frontend.
> **Destinatário:** Analista de Sistemas / Equipe de Produto / Desenvolvedores Front-end.

---

## 1. Padrões de Arquitetura Frontend

O MasterIA adota a arquitetura **App Router** do Next.js 15, dividindo o ecossistema em "Route Groups" (pastas entre parênteses) para organizar layouts complexos sem sujar as URLs finais. A interface utiliza **Radix UI** somado a **Tailwind CSS** (estilo Shadcn) para acessibilidade e consistência, enquanto o **Framer Motion** conduz as micro-interações.

### Server vs. Client Components
O sistema usa um design pattern híbrido agressivo:
- **Tabelas e Analytics:** Maioria processada via `Server Components` e `Server Actions` para reduzir o JavaScript no browser.
- **Interfaces de Roteamento (Inbox, Kanban, Flows):** Renderizadas no client-side (`"use client"`) usando `Zustand` / `React Context` devido à reatividade profunda e integração contínua via WebSockets (`Socket.IO`).

---

## 2. Roteamento e Acesso Externo (Páginas Públicas)

Essas rotas são projetadas para tráfego rápido, otimizadas para SEO (quando aplicável) e isoladas do layout autenticado.

### 2.1 Route Group `(marketing)` e `(public)`
- **`/login`, `/register`, `/forgot-password`**: Fluxo de autenticação. A lógica usa validações rigorosas e se comunica diretamente com Server Actions de sessão (`auth`).
- **`/termos`, `/politicas`, `/privacy`**: Páginas legais e estáticas, geradas no lado do servidor para indexação.
- **Formulários Públicos & Simuladores (`(standalone)` / `/linktest-crfpa`)**: Interfaces de captura desenhadas para rodarem fora do iframe da aplicação, servindo como "Landing Pages" autônomas que alimentam diretamente o banco de dados do MasterIA.

---

## 3. Painel de Controle Administrativo (Super-Admin)

O grupo de rotas `(super-admin)` é um módulo restrito aos proprietários da plataforma MasterIA. Ele opera acima de todos os workspaces (empresas) clientes.
- **`/super-admin/companies`**: Visão global de todos os tenants (clientes) ativos, faturamento, consumo de quotas de IA e saúde dos Webhooks.
- **`/super-admin/users` & `/super-admin/email-tracking`**: Auditoria profunda sobre as ações dos usuários globais, relatórios de e-mails disparados pela plataforma e gerenciamento de permissões globais.

---

## 4. O Coração do Sistema: Dashboard Principal `(main)`

Todo o fluxo de uso da plataforma reside sob o grupo `(main)`, envelopado em um `layout.tsx` central que provê o Sidebar dinâmico, verificação de Tenant (`companyId`) global via Context e Socket listeners.

Abaixo, um raio-x profundo de cada submódulo do SaaS:

### 4.1. Comunicação e Atendimento Omnichannel
#### 📍 Inbox Central (`/atendimentos`)
- **Lógica Front-end:** É um SPA (Single Page Application) dentro do Next.js. A tela divide-se em lista de conversas à esquerda e thread central. A reatividade depende unicamente do Socket.io.
- **Funcionalidades:** Permite pausar/ativar os Agentes de Inteligência Artificial por conversa. Possui atalhos para fechar tickets, adicionar notas internas, marcar como não lido, e enviar mídias variadas interceptando ações para os workers.

#### 📍 Gestão de Contatos (`/contacts` e `/lists`)
- **Lógica Front-end:** Data-tables avançadas e virtualizadas (permitindo carregar milhares de leads sem travar a UI). 
- **Funcionalidades:** Suporta filtros compostos e aninhados (por Tags, Status de CRM, Origem). Permite importação assíncrona massiva via arquivos CSV (tratada por `document-import.service`).

### 4.2. Gestão e Pipeline (CRM)
#### 📍 Kanban & Funis (`/kanban`, `/kanban/[funnelId]`)
- **Lógica Front-end:** Interface Drag-and-Drop baseada na tabela `kanban_leads`. Totalmente modular; usuários podem criar colunas personalizadas (Ex: Lead Novo -> Negociação -> Fechado).
- **Inteligência do Kanban:** Ao soltar um "card" numa nova coluna, a interface invoca uma Server Action silenciosa que avisa o `automation-engine`. A simples troca de estágio de um lead pode despertar a IA ou disparar um fluxo automático.

### 4.3. Ecossistema MasterIA (Ad-Intelligence e Campanhas)
#### 📍 Campanhas de Marketing (`/marketing`, `/marketing/campanhas`, `/campanhas`)
- **Lógica Front-end:** Utiliza *wizards* multi-passo. O usuário escolhe as segmentações de contato, o Template oficial da Meta e aprova o orçamento/quota. O front envia esse payload para ser quebrado e engolido pelo BullMQ (`campaign-trigger.worker`).
#### 📍 Ad-Intelligence Avançado (`/marketing/ad-intelligence`)
Um dos módulos mais robustos do frontend.
- **Abas de Análise Analítica:** Páginas como `cluster-analysis`, `creatives`, `global-intelligence`.
- **Lógica Front-end:** Busca dados agregados de performance (ROAS, CTR, CPM) vindos da API da Meta em tempo real, plotando gráficos complexos (Recharts). Permite visualizar *Creatives* e sugerir cópias otimizadas via IA ("Enrichment").
- **Funnel e Cohort:** Views dedicadas para `cohort-ltv` (tempo de vida do cliente) e retenção de vídeos (`retencao-video`).

### 4.4. Orquestração de Agentes IA e Voz
#### 📍 Agentes e Prompting (`/agentes-ia`, `/voice-ai`)
- **Lógica Front-end:** Interface sofisticada de criação de "Personas". Divide a criação da IA em abas:
  - **Identidade e Prompt:** Injeção de "System Prompts" customizados.
  - **Base de Conhecimento (RAG):** Componentes para Upload de PDFs ou links de Sites, processando a indexação vetorial.
  - **Voz e Fonética (`/voice-ai`):** Seletor interativo da ElevenLabs/Gemini Voice para configurar clonagem de voz, velocidade e estabilidade do áudio.
  - **Cadência/Pacing:** Ajuste manual das réguas de Atraso (Delays Humanizados).

### 4.5. Automações e Fluxos Visuais
#### 📍 Construtor de Flow (`/automacoes`, `/automacoes/[id]`)
- **Lógica Front-end:** Utiliza a biblioteca Node-Based `@xyflow/react` (React Flow).
- **UX/Interação:** O usuário literalmente arrasta nós ("Gatilho: Recebeu Webhook", "Condição: Lead comprou", "Ação: Mandar PDF e Áudio"). O grafo desenhado no front-end é serializado em JSON e salvo no banco de dados, sendo interpretado matematicamente por buscas em largura (`flow-engine.ts`) no backend.

### 4.6. Configurações Administrativas
#### 📍 Templates do WhatsApp (`/templates`, `/templates-v2`)
- Interface acoplada à API da Meta. Permite compor a estrutura (Header, Body com Variáveis `{{1}}`, Footer, Botões de CTA) e verificar em tempo real o status de aprovação ou banimento ("DRAFT", "APPROVED", "REJECTED").
#### 📍 Organizações e APIs (`/admin/organizations`, `/conexoes`)
- Telas de configuração das APIs essenciais (OpenAI, Gemini), escaneamento de QR Code nativo para os adaptadores Waha/Baileys, controle financeiro (faturas/cartões de crédito do SaaS) e convites de membros para as equipes (`/equipes`).

---

## 5. Estratégia de Gerenciamento de Estado
A complexidade das interfaces do MasterIA obriga o uso de uma hierarquia de estado bem definida:
- **Zustand:** Gerencia estados isolados e pesados (Ex: o Grafo e os nós sendo arrastados no módulo de Automações).
- **React Context:** Distribui os tokens de autenticação da sessão e o "Active Company" (empresa atual que o usuário está visualizando).
- **Server Actions / SWR:** Todo fetching de dados tabular obedece ao padrão SWR (Stale-While-Revalidate), atualizando silenciosamente dados financeiros e de CRM em background.
