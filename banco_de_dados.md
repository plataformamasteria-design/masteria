# Estrutura de Banco de Dados e Modelagem de Dados - MasterIA

> [!IMPORTANT]
> **Status:** Documentação de Banco de Dados (Schema Drizzle ORM)
> **Escopo:** Mapeamento Extensivo de Tabelas, Relações Multi-Tenant, Tipagem Estrita e Modelagem de Inteligência Artificial.
> **Destinatário:** Analista de Sistemas / DBA / Arquitetos Backend.

---

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
