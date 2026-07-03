# Lógica de Funcionamento e Fluxo de Dados - MasterIA

> [!IMPORTANT]
> **Status:** Documentação de Processos e Engenharia de Fluxo (Data Flow)
> **Escopo:** Como tudo se conecta: do recebimento de um Webhook até a resposta da Inteligência Artificial.
> **Destinatário:** Analista de Sistemas / Engenheiro de Software / QA.

---

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
