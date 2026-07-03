# Ficha Técnica e Arquitetura de Software - MasterIA

> [!IMPORTANT]
> **Status:** Documentação Técnica e Arquitetural (Extensa e Completa)
> **Escopo:** Mapeamento de Infraestrutura, Arquitetura de Backend, Motores de Inteligência Artificial, Ad-Intelligence e Fluxo de Dados de toda a aplicação MasterIA.
> **Destinatário:** Analista de Sistemas / Arquitetura de Software / Engenheiro Chefe.

---

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
