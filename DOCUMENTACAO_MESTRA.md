# 📘 Documentação Mestra de Engenharia - MasterIA

> [!IMPORTANT]
> **Status:** Dossiê Técnico Consolidado (Versão Final)
> **Escopo:** Arquitetura, Front-end, Banco de Dados, Fluxos de Dados e Diagramas.
> **Destinatário:** Analista de Sistemas / Engenheiros e Arquitetos.

---

## 📋 Índice

1. [Visão Arquitetural Macro e Stack Tecnológico](#1-visão-arquitetural-macro-e-stack-tecnológico)
2. [Documentação Funcional e Estrutura de Interface (Front-end)](#documentação-funcional-e-estrutura-de-interface-front-end---masteria)
3. [Estrutura de Banco de Dados e Modelagem de Dados](#estrutura-de-banco-de-dados-e-modelagem-de-dados---masteria)
4. [Lógica de Funcionamento e Fluxo de Dados](#lógica-de-funcionamento-e-fluxo-de-dados---masteria)
5. [Fluxograma de Arquitetura e Comunicação (Mermaid)](#fluxograma-de-arquitetura-e-comunicação---masteria)

---

# Ficha Técnica e Arquitetura de Software - MasterIA


## 1. Visão Arquitetural Macro e Stack Tecnológico

O sistema **MasterIA** é um **SaaS B2B Full-Stack** de alta complexidade. Ele funciona como uma central de orquestração de Inteligência Artificial, oferecendo gestão de relacionamento multicanal (CRM/Kanban), automação avançada de marketing no WhatsApp, inteligência algorítmica para Meta Ads (Ad-Intelligence) e orquestração de Agentes Autônomos.

A aplicação requer uma infraestrutura stateful (processos "Long-Running" via Node.js nativo), abandonando o modelo Serverless tradicional devido à necessidade de conexões WebSockets persistentes, processamento de filas e execução ininterrupta de workers em background.

### 1.1 Stack de Infraestrutura e Core
- **Framework Core:** Next.js 15 (App Router, unindo Server Actions e Client Components de forma fluida).
- **Runtime e Execução:** Node.js (>= 20) com otimização manual de memória e coleta de lixo ativada (`--max-old-space-size=2048 --expose-gc`).
- **Banco de Dados Relacional:** PostgreSQL 16 centralizado e gerido com **Drizzle ORM** (Schema único e tipagem forte ponta a ponta em todo o monolito).
- **Banco de Dados Vetorial (AI RAG):** PostgreSQL secundário dedicado (database: `masteria_vector_db`), que utiliza a extensão `pgvector` gerenciada via `drizzle.vector.config.ts`, focada exclusivamente na busca semântica para RAG (Retrieval-Augmented Generation).
- **Cache & Message Broker (Filas):** Redis 7 (utilizando `ioredis`) + **BullMQ**. Essencial para processar filas maciças (envio de campanhas e tratamento de concorrência de webhooks).
- **WebSockets:** Implementação customizada via `Socket.io` injetada diretamente no kernel do servidor HTTP para suportar atendimento real-time (inbox).
- **Armazenamento de Mídia Estruturado:** S3 API via `@aws-sdk/client-s3` com entrega em CDN via CloudFront.

### 1.2 Ecossistema de Inteligência Artificial
- **Orquestradores de IA:** AI SDK V3 oficial (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`).
- **Provedores Base (LLMs):** Múltiplos modelos, com forte integração com GPT-4o (OpenAI) e Gemini 2.5 (Google GenAI).
- **Voz e Fonética:** TTS avançado via ElevenLabs API para clonagem hiper-realista, mesclado ao Retell SDK para ligações e interações assíncronas por voz.
- **Engenharia de Prompt e Pacing (Neuro-Linguística):** Sistema avançado embutido nas regras (MasterIA Profiling). Ele identifica traços psicológicos do interlocutor (VAK - Visual, Auditivo, Cinestésico) para ajustar o tom de voz e calcular *delays* humanizados em respostas de texto e áudio.

---

## 2. Bootstrapping e Kernel do Servidor (`server.ts`)

A inicialização do MasterIA ignora o comando tradicional do Next.js. O sistema usa um invólucro customizado no `server.ts` que permite injetar infraestrutura complexa antes mesmo de compilar as views.

### O Ciclo de Vida do Servidor
1. **Health Check Caching:** O Node.js intercepta rotas `/health` e `/api/health` *antes* do motor do Next.js, respondendo requisições com latência de menos de 10ms para garantir que os Load Balancers não reiniciem a aplicação por timeout durante inicializações pesadas.
2. **Injeção do Socket.IO:** Instancia a comunicação bidirecional para atualizar o Kanban e a tela de Atendimentos.
3. **Internal Emit API:** Abre uma porta fechada (`/api/internal/socket-emit`) que recebe dados do backend puro e impulsiona eventos em tempo real para os clientes, otimizando o repasse de Webhooks da Meta Graph API.
4. **Acionamento dos Workers:** Uma vez que o App Router está compilado, instâncias apartadas do event-loop são ativadas para iniciar os escutadores do BullMQ.

---

## 3. Topologia de Filas e Background Workers (`src/workers/`)

O ecossistema interno do MasterIA requer que tarefas pesadas operem em segundo plano (Event-Driven Architecture).

1. **`campaign-trigger.worker.ts`**: Robô que devora campanhas massivas de mensagens. Ele particiona bases de contatos, calcula o atraso de rate-limit imposto pela API da Meta, processa o disparo e delega a comunicação para a camada de envio unificada.
2. **`automation-timeout.worker.ts`**: Trabalhador cronometrado que checa ações pausadas em fluxos (Ex: Nó "Aguardar 24 horas", ou encerramento automático de tickets que o cliente não responde há 72 horas).
3. **`copilot-scheduler.worker.ts`**: Engrenagem principal da IA autônoma para agendamentos passivos de reuniões, análise e acompanhamento recorrente do lead (follow-ups passivos).

---

## 4. O Cérebro do Sistema: Motores Lógicos (`src/lib/`)

O MasterIA não é apenas um sistema de formulários; a pasta `src/lib/` compõe o motor computacional da plataforma. Toda lógica crítica reside em mais de 100 submódulos fortemente tipados. Os pilares dessa arquitetura são:

### 4.1 Flow Engine (`flow-engine.ts`)
O interpretador de fluxos conversacionais (BFS Graph Traversal).
- Ele varre nós armazenados em um JSON graph complexo (nos moldes do Typebot/React Flow).
- Identifica condicionais baseados em variáveis de contexto e suporta bifurcação avançada.
- Monitora telemetria completa via `incrementNodeReached` para análise de funis conversacionais.

### 4.2 Automation Engine (`automation-engine.ts`)
O núcleo que executa a verdadeira "automação" e orquestração.
- **Roteamento de IA Hierárquico:** Ao receber uma mensagem, o sistema decide quem assume. Ele tenta achar uma "Persona" a nível de Estágio do Kanban, depois a nível de Funil inteiro, depois a nível da Conexão, antes de fazer fallback para os atendentes.
- **Ajuste Dinâmico e Delay Humanizado:** Identifica se o cliente responde de forma acelerada (Pacing FAST) ou mais reflexiva (Pacing SLOW) e ajusta algoritmicamente os atrasos de digitação (simulando que a IA está escrevendo na mesma velocidade que o cliente).
- **Calculadora de Transcrição:** Se o lead enviou um áudio, o Automation Engine mapeia a transcrição e adiciona "X" segundos ao delay simulando o tempo de oitiva do áudio real.
- **Interceptor de PII (Máscara de Segurança):** O sistema utiliza Regex pesado para omitir Cartões, Senhas e CPFs *antes* da requisição ir à LLM para evitar vazamento de contexto ou injeção de prompt maldoso.

### 4.3 Padrões de Conexão WhatsApp
O envio de mensagens é orquestrado por conectores de estado unificado.
- O MasterIA se conecta simultaneamente via Meta Graph Oficial e provedores independentes (Baileys/Evolution API/APICloud) provendo "fail-over" sem comprometer o fluxo de envio do Kanban.

### 4.4 Engine de Ad-Intelligence (`src/app/api/ad-intelligence`)
Um subsistema crítico dedicado à leitura e interpretação de dados de tráfego pago (Integração Meta Ads).
- Endpoints analíticos (`/api/ad-intelligence/cluster-analysis`, `/api/ad-intelligence/ranking`) puxam dados em tempo real.
- Analisam performance de *Creatives* de campanhas e utilizam a camada de LLM para cruzar dados métricos (ROAS, CTR) com variáveis qualitativas de campanha para prescrever otimizações autônomas para os usuários da plataforma.

---

## 5. Estratégia de Hospedagem (Docker/CI)

A aplicação foi rigorosamente documentada para operar por contêineres:
- **`docker-compose.yml`**: Roteia o banco de dados principal (port: 5433) isolado do banco vetorial (port: 5434), garantindo estabilidade e escalabilidade de recursos na busca semântica em paralelo aos inserts transacionais do CRM. Redis isolado roda na porta 6380.
- **Nixpacks**: Integração declarada de dependências na nuvem, garantindo instalação perfeita de bibliotecas criptográficas nativas necessárias ao Node.js.

*(Fim do documento Estrutura Geral)*


<br><br>

---

# Documentação Funcional e Estrutura de Interface (Front-end) - MasterIA


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


<br><br>

---

# Estrutura de Banco de Dados e Modelagem de Dados - MasterIA


## 1. Topologia de Banco de Dados e ORM

O ecossistema **MasterIA** possui um nível avançado de persistência de dados. A aplicação não roda queries SQL manuais cruas; ela é governada inteiramente pelo **Drizzle ORM** (em conjunto com o `drizzle-kit` para versionamento de migrações).

### 1.1 Separação de Partições
O sistema funciona com **duas partições PostgreSQL independentes**, operando paralelamente via Docker:
- **`masteria_db` (Porta 5433):** O banco de dados relacional (OLTP). Processa as transações de Core do SaaS (Mensagens, Disparos, Kanban, Automação, Organizações, Faturas).
- **`masteria_vector_db` (Porta 5434):** O banco vetorial gerido via extensão `pgvector`. Usado única e exclusivamente para armazenamento de *Embeddings* e execução de busca semântica para RAG (Retrieval-Augmented Generation) da Inteligência Artificial. Possui seu próprio arquivo de configuração Drizzle (`drizzle.vector.config.ts`).

---

## 2. Padrão Arquitetural: Multi-Tenancy Restrito
A plataforma MasterIA é um modelo **B2B SaaS Multi-Tenant**. Absolutamente todos os registros que não são globais estão algemados a um Inquilino.
- O campo principal transversal a quase todo o banco é o **`company_id`** (referenciando `companies.id`).
- Existe uma diretriz (Policy) de nível de código (chamada localmente de *Tenant Guard* nas consultas Drizzle) onde qualquer Query de leitura ou escrita *deve* passar um `.where(eq(tabela.companyId, companyId))`. O não fornecimento dessa chave resulta em falha de tipagem e compilação, prevenindo que a Empresa A leia os contatos da Empresa B.

---

## 3. Dicionário de Dados e Entidades Principais

O schema central está definido em `src/lib/db/schema.ts` com mais de 2.800 linhas, sendo o maior arquivo único da aplicação. As tabelas chaves dividem-se nos seguintes núcleos:

### 3.1 Núcleo Organizacional (Super-Admin e Auth)
- **`companies`**: Tabela mestra. Armazena as franquias/agências, incluindo regras globais de IA (`ai_knowledge_base`, `ai_model`) e regras de roteamento UTM (`utm_routing_rules`).
- **`company_quotas`**: Tranca de faturamento. Mapeia limites (ex: 10.000 tokens de IA/mês, 5.000 mensagens/mês). Os workers param de operar se essas *quotas* excederem.
- **`users`**: Administradores e Atendentes. Contém chaves OAuth (Google/Meta), tipo de permissão (`role` via `pgEnum`) e amarração Firebase Auth.
- **`company_financials`**: Mapeia *Fixed Costs* e pagamentos para relatórios do Super-Admin.

### 3.2 Núcleo de CRM e Atendimentos (Kanban)
- **`leads`**: O contato final do MasterIA. Armazena campos como Nome, Telefone e Diagnóstico do lead (se ele passou por qualificação da IA).
- **`kanban_boards` & `kanban_stages`**: Regras do funil. `kanban_stages` tem colunas com propriedades semânticas (`semanticType`) que orientam a IA, ex: um estágio chamado "Agendamento" ativa intenções preditivas.
- **`conversations`**: Guarda o "Ticket" ativo do lead. Contém o status: se está em `AI_ACTIVE` (robô falando) ou `HUMAN_ACTIVE` (um usuário em `users` assumiu a conversa, pausando as regras locais do Automation Engine).
- **`messages`**: Tabela coligada a conversas. Salva metadados ricos: tipo de mensagem (áudio, texto, imagem, template meta) e se falhou (`failed_reason`).

### 3.3 Núcleo de Canais de Comunicação (Omnichannel)
- **`whatsapp_connections`**: Mapeia sessões persistidas do Baileys/Evolution API/Waha e as integrações da Meta Cloud. Salva status de pareamento QR e contadores de disparo.
- **`whatsapp_templates`**: Tabela relacional que salva a cópia dos modelos previamente aprovados pela equipe da Meta.

### 3.4 Núcleo Cognitivo e Personas (Voice e AI)
- **`ai_personas`**: Entidade vital do SaaS. Armazena o Perfil comportamental do Robô (Prompt de Sistema, Tone of Voice, IDs da ElevenLabs para Voz), o ritmo de resposta (`fast/slow`) e limites de tolerância de erro (`max_errors_before_human`).
- **`whatsapp_delivery_reports` (Tabela de Memória de Curto Prazo)**: O MasterIA é assíncrono. Esta tabela registra *Double-Send Preventers*. Quando uma IA engatilha envio, a requisição passa por aqui e trava por 5 minutos, garantindo que o Webhook desordenado não gere mensagens duplicadas pro mesmo lead.

### 3.5 Núcleo de Automação Visual (Flow Builder)
- **`automation_flows`**: Grava os metadados do Funil e o estado global de Publicado/Draft.
- **`automation_nodes`**: Os "blocos" da automação arrastados pelo usuário. Salvos em `jsonb`. Eles mapeiam as conexões do Grafo (`edges`), Gatilhos (`conditions`), Delays de timeout, e Disparos de webhook internos. 
- A lógica de transição entre blocos não reside em chaves estrangeiras densas (`foreign keys`), mas sim no motor matemático de travessia do grafo, extraindo os vetores diretamente do `jsonb` do nó e iterando os workers sobre eles.

### 3.6 Núcleo Ad-Intelligence
- Embora as campanhas de anúncios fiquem registradas nos servidores da Meta, o banco espelha *caching* massivo.
- Tabelas como `ad_intelligence_reports` e `ad_sync_logs` guardam consolidações financeiras horárias. A IA roda sobre esses relatórios locais (em vez de bater na Graph API a cada load de página) para sugerir melhorias de CPL (Custo por Lead).

---

## 4. Otimizações de Perfomance (Drizzle & PostgreSQL)

O modelo de dados MasterIA é desenhado para não engasgar em "Full Table Scans" durante disparos de Black Friday ou enchentes de Webhooks:
- **Índices Compostos e Chaves Parciais:** Tabelas gigantescas (`messages` e `leads`) usam `index()` maciço focado na chave-dupla `(companyId, status)`.
- **Delete Cascades:** `company_id` carrega um constraint `{ onDelete: 'cascade' }`. Caso o Super-Admin delete uma empresa em `/super-admin/companies`, todas as métricas, faturas, conversas e blocos de automação daquele lojista sumirão instantaneamente via nível de banco.
- **Enumerações e Tipagem JSONB:** O projeto explora severamente colunas `jsonb` para evitar "Over-Normalização". Dados como Custom Fields de formulários de leads, botões de templates da Meta e regras matemáticas do Flow Engine não viram tabelas adicionais, vivem empacotados dentro do schema em formato `JSONB`, sendo tipados por `type` TypeScript no lado da aplicação via Drizzle.


<br><br>

---

# Lógica de Funcionamento e Fluxo de Dados - MasterIA


Este documento detalha o ciclo de vida da informação dentro do ecossistema **MasterIA**, explicando como as camadas de Frontend, Backend, Filas (Workers) e Banco de Dados interagem durante os processos mais críticos.

---

## 1. Fluxo Core: Recepção de Mensagem e Resposta da IA

O principal motor de valor do MasterIA é a capacidade de receber mensagens via WhatsApp, processar regras de automação e gerar uma resposta autônoma via LLM.

### 1.1. O Caminho do Webhook (Inbound)
1. **Recepção (Meta API / Evolution / Waha):** O cliente final envia uma mensagem no WhatsApp. A API provedora dispara um `POST` para o endpoint de Webhook do MasterIA (ex: `/api/webhooks/evolution`).
2. **Normalização:** O Backend recebe o payload cru e o normaliza para um formato padrão (`WebhookMessageInterface`).
3. **Persistência Inicial:** O Drizzle ORM insere a mensagem na tabela `messages` atrelada à tabela `conversations`. 
4. **Acionamento do Motor:** Imediatamente após salvar no banco, o sistema invoca o `automation-engine.ts`.

### 1.2. Processamento (Automation Engine)
1. **Verificação de Estado:** O motor checa se a conversa está em `HUMAN_ACTIVE` (um humano assumiu). Se sim, a automação é abortada e nada acontece.
2. **Identificação da Persona:** Estando em `AI_ACTIVE`, o sistema busca qual `ai_persona` deve responder. A busca respeita a hierarquia: Regra do Estágio do Kanban -> Regra do Funil -> Regra da Conexão.
3. **Segurança (PII Masking):** A mensagem crua do usuário passa por uma função de *Input Security Check*. Regex removem CPFs, números de cartão e chaves pix, trocando-os por `[REDACTED]`, protegendo o banco vetorial e evitando engenharia social na LLM.
4. **Análise de Pacing e Sentimento:** O motor cruza os dados e calcula a velocidade de resposta do usuário (Perfil VAK). Se for um áudio, calcula o tamanho da string transcrita para injetar um atraso (Delay Humanizado).

### 1.3. Orquestração de LLM e Envio (Outbound)
1. **Montagem do Contexto (RAG):** O motor puxa as últimas N mensagens da tabela `messages` e faz uma busca semântica (`pgvector` no `masteria_vector_db`) nos PDFs/Links da empresa para achar o contexto perfeito para a resposta.
2. **Chamada LLM:** Dispara o prompt empacotado para o Provedor (`@ai-sdk/openai` ou `@ai-sdk/google`).
3. **Fila de Envio:** A resposta gerada é colocada na tabela `whatsapp_delivery_reports` (para evitar envios duplos num intervalo de 5 minutos) e enfileirada.
4. **Socket EMIT:** Simultaneamente, o servidor Node.js dispara um evento `Socket.IO` ("new_message").
5. **Atualização do Front-end:** A tela de `/atendimentos` do atendente (SPA em React) "escuta" o evento via Websocket e renderiza a mensagem da IA na tela em tempo real, sem necessidade de *refresh*.

---

## 2. Fluxo de Automação Visual (Flow Builder)

O MasterIA permite desenhar fluxos condicionais complexos (`/automacoes`). A matemática de como isso funciona:

1. **Geração do Grafo (Frontend):** O usuário usa *Drag-and-Drop*. Ao salvar, o Zustand gera um objeto JSON contendo `nodes` (blocos) e `edges` (linhas de conexão) e envia via `Server Action` para salvar em `automation_nodes`.
2. **Gatilho Inicial:** Quando ocorre um evento (ex: Tag adicionada, ou Palavra-chave digitada pelo Lead), o `flow-engine.ts` é acordado.
3. **Travessia BFS (Busca em Largura):** 
   - O motor pega o `node` raiz do JSON.
   - Lê as condições (Ex: `if lead.tags.includes('VIP')`).
   - Avalia a condição. Se verdadeira, ele encontra o ID da aresta (`edge`) correspondente e viaja para o próximo nó.
   - O motor possui proteção contra "Loops Infinitos" limitando o *Depth* da travessia.
4. **Acionamento de Ação:** Ao cair em um nó de "Enviar Mensagem", o Flow Engine cria um *Job* no BullMQ (`automation-timeout.worker`) caso o usuário tenha colocado um Delay, ou invoca o disparador imediatamente.

---

## 3. Fluxo de Disparo de Campanhas Massivas

Um gargalo clássico de CRMs SaaS é o disparo em massa para milhares de contatos. O MasterIA blinda o servidor Web dessa carga via Filas (EDA).

1. **Wizard de Campanha:** O usuário no Frontend configura as regras, escolhe o modelo aprovado (Template Meta) e clica em enviar.
2. **Chunking Inicial:** O Next.js (`Server Action`) pega a base de 10.000 contatos e corta em blocos menores ("Chunks"), salvando a intenção no banco e disparando o ID da campanha para a fila principal no Redis.
3. **Worker de Trigger (`campaign-trigger.worker.ts`):** O processo *background* acorda. Ele puxa o bloco de contatos, avalia o Rate-Limit permitido para o número da empresa (ex: Tier 1 Meta - 1k envios/dia) e calcula um atraso randômico entre cada contato.
4. **Agendamento no BullMQ:** O Trigger Worker agenda os disparos individuais de volta no BullMQ.
5. **Worker de Envio:** Na hora exata calculada, o BullMQ executa o envio direto para a Cloud API da Meta, atualizando o status do ticket em `messages` e decrementando as quotas mensais da empresa em `company_quotas`.

---

## 4. Fluxo de Ad-Intelligence (Insights de Marketing)

1. **Ingestão (Sync Automático):** Um CRON job diário invoca a `/api/ad-intelligence/sync`. Ele bate na API de marketing da Meta e importa as métricas (Gastos, Cliques, Compras) e os criativos brutos para o banco local.
2. **Processamento (Cluster Analysis):** Quando o usuário acessa `/marketing/ad-intelligence`, o servidor processa a `/api/ad-intelligence/cluster-analysis`, agrupando os criativos vencedores através do cruzamento de ROAS (Retorno) e CPM.
3. **Prescrição LLM:** Se o usuário solicita uma melhoria de Copy (texto do anúncio), o Frontend chama a IA injetando no prompt as métricas numéricas, forçando a LLM a entender não apenas semântica, mas conversão financeira, retornando textos otimizados prontos para publicação.

---

### Resumo Arquitetural
Tudo no MasterIA foi desenhado prevendo **Escalabilidade (BullMQ/Redis)**, **Tempo Real (Socket.io acoplado ao Server HTTP)** e **Segurança Isolada de Dados (PostgreSQL + Drizzle Tenant Guards)**.


<br><br>

---

# Fluxograma de Arquitetura e Comunicação - MasterIA

    %% CONEXÕES E FLUXOS
    %% ---------------------------

    %% 1. Inbound: Do Cliente até o Motor
    Client -- "Envia Mensagem (Webhook)" --> NextAPI
    NextAPI -- "Salva a Mensagem e verifica o Tenant" --> DB_Relacional
    NextAPI -- "Gatilho de nova mensagem" --> AutoEngine

    %% 2. Processamento IA e Regras
    AutoEngine -- "Interpreta regras do Funil" --> Kanban
    AutoEngine -- "Busca conhecimento (Embeddings)" --> DB_Vector
    AutoEngine -- "Envia Prompt Limpo (Sem PII)" --> OpenAI
    OpenAI -- "Devolve Resposta (Texto)" --> AutoEngine
    AutoEngine -- "Solicita Áudio (opcional)" --> ElevenLabs

    %% 3. Outbound e Tempo Real
    AutoEngine -- "Agenda Disparo / Evita duplo envio" --> BullMQ
    AutoEngine -- "Dispara Atualização na Tela" --> WebSockets
    WebSockets -- "Ouve Evento 'new_message'" --> Inbox
    WebSockets -- "Atualiza Card" --> Kanban

    %% 4. Disparos em Massa (Campanhas)
    Dashboard -- "Agenda Campanha" --> NextAPI
    NextAPI -- "Joga Chunks na Fila" --> BullMQ
    BullMQ -- "Processa Lote respeitando Rate Limit" --> WorkerTrigger
    WorkerTrigger -- "Envia Mensagens em Massa" --> Client

    %% 5. Automações Condicionais
    FlowBuilder -- "Desenha nós em JSON" --> NextAPI
    NextAPI -- "Salva Grafo" --> DB_Relacional
    DB_Relacional -- "Carrega JSON para Memória" --> FlowEngine
    FlowEngine -- "Calcula Delays/Timeouts" --> WorkerTimeout
    WorkerTimeout -- "Executa ação tardia" --> NextAPI

    %% 6. Ad-Intelligence (Integração)
    Server -- "CRON Job de Sincronização" --> MetaAds
    MetaAds -- "Retorna Métricas de CPL/ROAS" --> DB_Relacional
    Dashboard -- "Visualiza Gráficos (Dashboard Insights)" --> NextAPI
    NextAPI -- "Pede para IA sugerir Copy" --> OpenAI
```

### Entendendo o Fluxo pelas Cores:
- 🟣 **Roxo (Externo):** Canais onde os dados nascem (Clientes no Zap) ou fornecedores vitais de I.A (OpenAI) e Tráfego (Meta).
- 🔵 **Azul (Front-end):** A interface do MasterIA, altamente responsiva. O *Inbox* depende estritamente do verde (*WebSockets*) para viver em tempo real.
- 🟢 **Verde (Back-end / Cérebro):** Onde a mágica ocorre. O `server.ts` injeta o Socket.io e intercepta a API do Next.js. O *Automation Engine* orquestra a comunicação, limpa dados sensíveis (PII) e comanda o envio.
- 🔴 **Vermelho (Background Workers):** A barreira contra quedas. O Redis segurando milhares de requisições via BullMQ para disparos de marketing em massa sem derrubar o container.
- 🟠 **Laranja (Bancos de Dados):** O *Drizzle ORM* conectando-se a dois corações em paralelo. O DB Relacional para armazenar Leads/Mensagens e o Vector DB para buscas matemáticas de Inteligência Artificial (RAG).


<br><br>

---

