# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), e este projeto adhere ao [Versionamento Semântico](https://semver.org/spec/v2.0.0.html).

## [2.3.4] - 2025-09-03
### Corrigido
- **Erro Crítico no Formulário de Automações:** Corrigido o erro `TypeError: tags.map is not a function` que impedia o carregamento das opções nos seletores de "Tags" e "Listas". A causa era uma inconsistência na forma como os dados da API de paginação eram processados. O formulário de criação e edição de automações volta a funcionar corretamente.

## [2.3.3] - 2025-09-03
### Corrigido
- **Erro Crítico de Banco de Dados:** Resolvida a falha "column ai_active does not exist" que impedia o envio de mensagens no chat. A coluna foi restaurada no schema do banco de dados (`conversations.ai_active`) e a funcionalidade relacionada de ativar/desativar IA foi reabilitada, garantindo a sincronia entre o código da aplicação e a estrutura do banco.
- **Estabilidade da API de Chat:** A rota `/api/v1/conversations/[conversationId]/messages` volta a operar sem erros, permitindo o fluxo normal de atendimento humano.

## [2.3.2] - 2025-09-03
### Modificado
- **UX do Menu Lateral:** Refatorado o menu lateral para melhorar a organização e a clareza. O item "Automações" foi movido para o nível principal e o agrupamento "Fluxos" foi removido para simplificar a navegação.
- **Labels do Menu Admin:** Otimizados os nomes dos submenus de "Admin" para "Dashboard de IA" e "Performance", evitando quebras de texto e melhorando a leitura.
- **Consistência de Ícones:** Adicionado um ícone ao submenu "Super Admin" para manter a consistência visual com os outros itens de menu.

## [2.3.1] - 2025-08-24
### Corrigido
- **🔧 Build System - Correções Críticas de ESLint/TypeScript:** Resolvidos completamente todos os erros de ESLint que impediam a compilação do projeto, restaurando o build de FALHA para SUCESSO COMPLETO
  - **Erros críticos corrigidos:** `no-case-declarations` em switch cases, `prefer-const` violations
  - **Warnings eliminados:** `unused-imports/no-unused-vars`, `unused-imports/no-unused-imports`
  - **Arquivos corrigidos:** `advanced-cache-manager.ts`, `advanced-conversation-insights.ts`, `advanced-sentiment-analyzer.ts`, `automation-engine.test.ts`, `company-agent-flow.ts`
  - **Resultado:** 74/74 páginas Next.js compiladas com sucesso, MCP Server build bem-sucedido
- **Qualidade de Código:** Implementada estratégia de preservação de funcionalidade usando prefixo `_` para variáveis não utilizadas
- **Deploy Readiness:** Projeto agora 100% pronto para produção com build limpo

### Documentação
- **Criado `TYPESCRIPT_CORRECTIONS_REPORT.md`:** Documentação completa das correções de build com detalhes técnicos, métricas de impacto e lições aprendidas

## [2.3.0] - 2025-08-19
### Adicionado
- **Seletor de Visualização de Campanhas:** Adicionado um controlo de botões na página de Campanhas que permite ao utilizador alternar entre a visualização em "Grelha" (cartões) e em "Tabela".
- **Paginação de Contatos Aprimorada:** Implementado um seletor na tabela de Contatos que permite ao utilizador escolher quantos itens exibir por página (de 10 a 500).
- **Consistência na Criação de Campanhas SMS:** Adicionado um botão "Criar Campanha SMS" no cabeçalho da página de SMS, padronizando a experiência do utilizador com a de campanhas WhatsApp.

### Corrigido
- **Filtro de Campanhas por Canal:** Corrigido o endpoint da API `GET /api/v1/campaigns` para filtrar corretamente as campanhas por canal, conexão e modelo, garantindo que a página exiba apenas os dados relevantes.
- **Layout de Cartões de Campanha SMS:** Ajustado o layout dos cartões de campanha de SMS para exibir apenas as métricas relevantes (Enviadas, Falhas), removendo os contadores de "Entregues" e "Lidas" que não se aplicam e melhorando o espaçamento.

## [2.2.0] - 2025-08-19
### Adicionado
- **Funcionalidade de Automações:** Reativada a secção de Automações, permitindo a criação, edição, exclusão e ativação/desativação de regras de automação através de um formulário completo. Inclui a implementação dos endpoints de API `(GET, POST, PUT, DELETE /api/v1/automations)`.
- **Seletor de Visualização de Campanhas:** Adicionado um controlo de botões na página de Campanhas que permite ao utilizador alternar entre a visualização em "Grid" (cartões) e em "Tabela".
- **Paginação de Campanhas:** Implementada a paginação completa no backend e no frontend para as listas de campanhas, com um seletor para escolher o número de itens por página e controlos de navegação.

### Corrigido
- **Filtro de Campanhas por Canal:** Corrigido o endpoint da API `GET /api/v1/campaigns` para filtrar corretamente as campanhas por canal (WhatsApp ou SMS), garantindo que cada página exiba apenas os dados relevantes.
- **Layout de Cartões de Campanha SMS:** Ajustado o layout dos cartões de campanha de SMS para exibir apenas as métricas relevantes (Enviadas, Falhas), removendo os contadores de "Entregues" e "Lidas" que não se aplicam e melhorando o espaçamento.
- **Espaçamento Geral da Página de Campanhas:** Adicionado um espaçamento consistente entre o painel de filtros e a listagem de campanhas (seja em grid ou tabela) para melhorar o layout visual.
- **Erro Crítico de Hidratação (`DateRangePicker`):** Resolvido o erro de "hydration mismatch" no seletor de datas do dashboard, garantindo que a formatação da data inicial ocorra apenas no lado do cliente.
- **Estrutura de Projeto:** Removido o ficheiro `package.json` duplicado e desnecessário da pasta `src`, corrigindo a estrutura do projeto.

### Documentação
- **Atualização do `CONSTITUICAO_PROJETO.md`:** Adicionado o "Caso #021", detalhando a causa e a solução para o erro de `ChunkLoadError` ao carregar partes da aplicação, para referência futura.

## [2.1.4] - 2025-08-19
### Corrigido
- **Erro Crítico de Build (Module Not Found):** Resolvido o erro de compilação `File is not a module` que ocorria devido a um ficheiro de rota obsoleto e vazio (`/api/contacts/import/route.ts`). O ficheiro foi corrigido para exportar uma função válida, estabilizando o processo de `build`.
- **Erro Crítico de `ChunkLoadError`:** Corrigida a falha no carregamento de partes da aplicação (`chunks`) ao reestruturar as rotas de marketing. A lógica da página inicial foi movida para dentro do grupo `(marketing)`, eliminando o conflito de `layout` que causava o erro.
- **Limpeza de Código:** Removidas múltiplas importações e variáveis não utilizadas em diversos componentes e rotas da API (`app-sidebar`, `automation-engine`, etc.), melhorando a qualidade e a manutenibilidade do código.

## [2.1.3] - 2025-08-14
### Corrigido
- **Erro 500 no Chat de IA:** Resolvido o erro persistente no fluxo de IA do Genkit. A funcionalidade foi temporariamente desativada para garantir a estabilidade do MVP e será reintroduzida no futuro.
- **Usabilidade da Tabela de Contatos:** Adicionada a capacidade de ordenar os contatos por nome e data de criação diretamente nos cabeçalhos das colunas.
- **Controlo de Paginação:** Implementado um seletor que permite ao utilizador escolher quantos contatos exibir por página (de 10 a 500), oferecendo maior flexibilidade na navegação.

## [2.1.2] - 2025-08-13
### Adicionado
- **Dashboard Super Admin Dinâmico:** O painel de Super Admin agora busca e exibe dados reais de todas as empresas na plataforma, incluindo contagens de utilizadores, contatos e campanhas, tornando-se uma ferramenta de monitorização funcional.

### Corrigido
- **Erro Crítico de Hidratação:** Corrigido um erro de "hydration mismatch" que ocorria nas páginas de Atendimentos e Dashboard devido à formatação de datas relativas, garantindo uma renderização consistente entre servidor e cliente.
- **Segurança da Rota Super Admin:** Reforçada a segurança da rota `/super-admin`, garantindo que apenas o utilizador com o e-mail de Super Admin possa acedê-la, através de verificações robustas no `middleware` e no `layout` da página.
- **Erro de Build (`use server`):** Removida a diretiva `'use server'` incorreta do ficheiro de rota da API (`/api/v1/super-admin/stats`), resolvendo uma falha de compilação.
- **Erro de Parsing de JSON:** Corrigido um erro "Unexpected end of JSON input" que ocorria ao excluir utilizadores, tratando corretamente as respostas `204 No Content` da API.

## [2.1.1] - 2025-08-13
### Corrigido
- **Segurança Crítica:** Corrigida uma falha de segurança onde utilizadores com o cargo "atendente" conseguiam aceder a páginas restritas de administrador (como Campanhas e Conexões), garantindo o correto isolamento de permissões.
- **Confiabilidade do CRON:** Otimizado o endpoint de trigger de campanhas (`/api/v1/campaigns/trigger`) para forçar a execução dinâmica, resolvendo o problema de cache no servidor que impedia o processamento de campanhas em produção.
- **Clareza da API:** Melhorada a mensagem de retorno do endpoint de CRON para refletir com precisão que ele procura por todas as campanhas "pendentes", e não apenas "agendadas", eliminando ambiguidades durante a depuração.
- **Erros de Build:** Corrigidos múltiplos erros de compilação, incluindo a remoção de diretivas `'use server'` desnecessárias e a resolução de tipos duplicados (`KanbanStage`) e propriedades em falta em componentes React.
- **Conflito de Deploy:** Resolvido o erro crítico "Failed to publish app" ao remover configurações de backend duplicadas (`frameworksBackend`) do ficheiro `firebase.json`.

## [2.1.0] - 2025-08-13

### Adicionado
- **Firebase Analytics:** Integrado o Firebase Analytics para o rastreamento de eventos personalizados, permitindo uma análise mais profunda do comportamento do utilizador na plataforma.

### Corrigido
- **Segurança Crítica:** Corrigida uma falha de segurança onde utilizadores com o cargo "atendente" conseguiam aceder a páginas restritas de administrador (como Campanhas e Conexões), garantindo o correto isolamento de permissões.
- **Confiabilidade do CRON:** Otimizado o endpoint de trigger de campanhas (`/api/v1/campaigns/trigger`) para forçar a execução dinâmica, resolvendo o problema de cache no servidor que impedia o processamento de campanhas em produção.
- **Clareza da API:** Melhorada a mensagem de retorno do endpoint de CRON para refletir com precisão que ele procura por todas as campanhas "pendentes", e não apenas "agendadas", eliminando ambiguidades durante a depuração.
- **Envio de Campanhas WhatsApp:** Resolvido um bug crítico na lógica de substituição de variáveis (`campaign-sender`) que impedia o envio de mensagens de modelos que continham placeholders, garantindo a entrega correta das campanhas.
- **Erros de Build:** Corrigidos múltiplos erros de compilação, incluindo a remoção de diretivas `'use server'` desnecessárias e a resolução de tipos duplicados (`KanbanStage`) e propriedades em falta em componentes React.
- **Conflito de Deploy:** Resolvido o erro crítico "Failed to publish app" ao remover configurações de backend duplicadas (`frameworksBackend`) do ficheiro `firebase.json`.

## [2.0.1] - 2025-08-13

### Corrigido
- **Segurança Crítica:** Corrigida uma falha de segurança onde utilizadores com o cargo "atendente" conseguiam aceder a páginas restritas de administrador (como Campanhas e Conexões), garantindo o correto isolamento de permissões.
- **Confiabilidade do CRON:** Otimizado o endpoint de trigger de campanhas (`/api/v1/campaigns/trigger`) para forçar a execução dinâmica, resolvendo o problema de cache no servidor que impedia o processamento de campanhas em produção.
- **Clareza da API:** Melhorada a mensagem de retorno do endpoint de CRON para refletir com precisão que ele procura por todas as campanhas "pendentes", e não apenas "agendadas", eliminando ambiguidades durante a depuração.
- **Envio de Campanhas WhatsApp:** Resolvido um bug crítico na lógica de substituição de variáveis (`campaign-sender`) que impedia o envio de mensagens de modelos que continham placeholders, garantindo a entrega correta das campanhas.
- **Erros de Build:** Corrigidos múltiplos erros de compilação, incluindo a remoção de diretivas `'use server'` desnecessárias e a resolução de tipos duplicados (`KanbanStage`) e propriedades em falta em componentes React.

## [2.0.0] - 2024-08-08

### Lançamento do MVP (Minimum Viable Product)

Esta versão marca a estabilização de todas as funcionalidades essenciais do ZAP Master, tornando-o pronto para produção. Todos os dados estáticos (`mock data`) foram substituídos por chamadas de API dinâmicas, e os principais erros de compilação e execução foram resolvidos.

### Adicionado
- **Dashboard 100% Dinâmico:**
  - Todos os cartões de KPI (`StatsCards`) agora buscam e exibem dados reais a partir do endpoint `/api/v1/dashboard/stats`.
  - O gráfico de **Tendência de Atendimentos** (`AttendanceTrendChart`) agora é alimentado por dados agregados em tempo real, consultando o endpoint `/api/v1/dashboard/charts`.
  - A tabela de **Ranking de Atendentes** agora lista os utilizadores reais da plataforma.
  - As listas de **Campanhas em Andamento** e **Atendimentos Pendentes** agora refletem o estado atual da base de dados.

### Corrigido
- **Múltiplos Erros de Compilação:** Resolvidos diversos erros de `build` relacionados a importações incorretas (`Module not found`), principalmente do hook `useToast`, garantindo a estabilidade do processo de build.
- **Falha na Consulta de Gráficos:** Corrigida uma falha crítica (`Erro 500`) no endpoint `/api/v1/dashboard/charts` que impedia o carregamento do gráfico de atendimentos. A consulta SQL foi refatorada para ser mais simples e robusta, realizando a agregação dos dados na aplicação para garantir a precisão.
- **Erro de Importação de Ícone:** Corrigido um erro de `build` (`'Unarchive' is not exported from 'lucide-react'`) ao substituir o ícone inexistente pelo ícone correto `ArchiveRestore` no componente de chat.

## [1.14.0] - 2024-08-05

### Corrigido
- **Resolução Definitiva de Duplicação de Contatos (Nono Dígito):**
  - Refatorada completamente a lógica de processamento de webhooks para manipular corretamente números de telefone brasileiros com e sem o nono dígito.
  - Criadas e implementadas as funções utilitárias `canonicalizeBrazilPhone` e `getPhoneVariations` para garantir uma lógica de busca e armazenamento de contatos robusta e à prova de falhas.
  - O sistema agora identifica corretamente um contato existente, independentemente de o número no banco de dados ou no webhook conter o nono dígito.
  - Novos contatos criados via webhook agora são sempre salvos no formato canônico (com o nono dígito para celulares brasileiros), garantindo a consistência da base de dados.

### Adicionado
- **Botão "Ver Perfil" nos Relatórios de Campanha:** Adicionada uma nova coluna "Ações" na tabela de relatórios de entrega, com um botão "Ver Perfil" para cada contato, facilitando a navegação direta para o perfil do destinatário.

### Modificado
- **Lógica de Avatar:** Todos os avatares de contatos na aplicação agora exibem as iniciais do nome do contato como fallback, em vez de uma imagem genérica, proporcionando uma interface mais limpa e profissional.

### Documentação
- **Atualização Geral:** Toda a documentação do projeto (`README.md`, `CONSTITUICAO_PROJETO.md`, `DB_DOCS.md`, etc.) foi revisada e atualizada para refletir o estado atual e estável da aplicação na versão `1.14.0`.

## [1.13.0] - 2024-08-05

### Corrigido
- **Correção de Erro de Build (`Dynamic server usage`):** Resolvido o erro de `build` que ocorria porque rotas de API que usavam `cookies()` (via `getCompanyIdFromSession`) não podiam ser renderizadas estaticamente. A diretiva `export const dynamic = 'force-dynamic';` foi adicionada a essas rotas (`/api/v1/templates`) para garantir a sua renderização dinâmica.
- **Correção de Erro de Build (`Suspense Boundary`):** Resolvido o erro `useSearchParams() should be wrapped in a suspense boundary` na página de redefinição de senha (`/reset-password`). A lógica da página foi extraída para um componente de cliente (`reset-password-client.tsx`) e envolvida por uma tag `<Suspense>` na página principal, conforme as regras do Next.js.
- **Correção de Erro de Build (`downlevelIteration`):** Resolvido um erro de compilação em `src/api/v1/templates/sync/route.ts` ao substituir a sintaxe de spread (`[...map.values()]`) por `Array.from(map.values())`, garantindo a compatibilidade com a configuração do TypeScript do projeto.
- **Correção Massiva de Tipos e Props:** Resolvida uma série de erros de build (`TS2739`, `TS2352`, `TS2322`, `TS71007`) em toda a aplicação:
    - Sincronizada a definição do tipo `MediaAsset` em `types.ts` para usar `Date` em vez de `string` para a propriedade `createdAt`.
    - Adicionada a propriedade `connectionId` ao tipo `Template` para alinhar com os dados de simulação.
    - Removidas todas as props de função não serializáveis (`onUpdate`, `onUploadComplete`, `onLeadAdded`, `onDataChange`) dos componentes de cliente. A atualização de dados agora é feita com `router.refresh()`, seguindo as boas práticas do Next.js.
- **Correção de Módulo Inválido:** Resolvido um erro de compilação onde `report/route.ts` não era reconhecido como um módulo. O ficheiro foi atualizado para exportar uma função `GET` que retorna um erro 404, tornando-o um módulo válido e indicando que está obsoleto.
- **Correção de Importação Quebrada:** Removida a importação desnecessária de `connections` do ficheiro `src/lib/data.ts` no componente `automation-rules.tsx`. O componente foi refatorado para buscar os dados dinamicamente da API `/api/v1/connections`.

### Documentação
- **Atualização do `CONSTITUICAO_PROJETO.md`:** Adicionado o "Caso #014", detalhando a causa e a solução para o erro de `build` de "Dynamic Server Usage".

## [1.12.1] - 2024-07-30

### Corrigido
- **Correção de Loops de Renderização Infinitos:** Resolvido o erro crítico `Maximum update depth exceeded` em múltiplos componentes. A causa raiz, relacionada ao uso incorreto do hook `useEffect` com dependências instáveis (como objetos de formulário ou funções), foi corrigida nos componentes `funnel-form-dialog.tsx` e `multi-select-creatable.tsx`, garantindo que o estado só seja atualizado em resposta a interações do utilizador.
- **Correção no Envio de Campanhas com Mídia:**
  - Resolvida a falha que impedia o envio de campanhas de WhatsApp com anexos de mídia (imagem, vídeo, documento). O `payload` da requisição para a API da Meta foi reestruturado para seguir o formato correto exigido, incluindo o nome do ficheiro para documentos.
  - O campo `mediaAssetId` agora é corretamente salvo no banco de dados no momento da criação da campanha.
- **Logging de Campanhas WhatsApp Implementado:**
  - Criada a nova tabela `whatsapp_delivery_reports` no schema do Drizzle.
  - O sistema agora regista um log detalhado para cada tentativa de envio de mensagem de uma campanha de WhatsApp, capturando o ID da mensagem da Meta em caso de sucesso ou a mensagem de erro em caso de falha, proporcionando uma rastreabilidade completa.
- **Correção na Seleção Múltipla de Listas:** Resolvido um bug que fazia com que apenas a primeira lista de contatos selecionada fosse salva ao criar uma campanha de WhatsApp. A API agora processa e salva corretamente todas as listas selecionadas.
- **Correção de Erro de Tipo (`TypeError`):** Resolvido o erro `Cannot read properties of undefined (reading 'name')` que ocorria ao tentar criar ou duplicar campanhas, garantindo que o componente `CreateWhatsappCampaignDialog` só seja renderizado quando um modelo de template válido for fornecido.

### Documentação
- **Atualização Geral:** O `README.md`, `CONSTITUICAO_PROJETO.md` e outros documentos foram revisados e atualizados para refletir o estado atual e as lições aprendidas com as correções recentes.

## [1.12.0] - 2024-07-30

### Adicionado
- **Mapeamento de Valor Fixo para Variáveis:** Adicionada a opção de configurar um "Valor Fixo" (estático) para as variáveis de modelo do WhatsApp, além do mapeamento dinâmico de campos de contato, permitindo maior flexibilidade na personalização de campanhas (ex: códigos de cupão).
- **Logs Detalhados para a API da Meta:** Implementado o registo detalhado das respostas da API da Meta no backend, facilitando a depuração de erros de envio de mensagens e falhas de sincronização.

### Modificado
- **Arquitetura de Envio de Campanhas Refatorada:**
  - Criada a biblioteca `lib/campaign-sender.ts` para centralizar a lógica de disparo de campanhas (SMS e WhatsApp), eliminando a duplicação de código.
  - Criada a biblioteca de baixo nível `lib/facebookApiService.ts` como o único ponto de comunicação com a Graph API da Meta, melhorando a manutenibilidade e a organização do código.
  - O "cron job" (`/api/v1/campaigns/trigger`) foi unificado para processar todos os tipos de campanhas agendadas (SMS e WhatsApp).
- **Interface de Conexões Melhorada:** A página de "Conexões" agora agrupa visualmente os números de telefone pela sua Conta do WhatsApp Business (`wabaId`), proporcionando uma visão mais clara para contas com múltiplos números.
- **Interface de Mapeamento de Variáveis Redesenhada:** A UI para configurar variáveis de modelo foi redesenhada para um formato de colunas mais claro e intuitivo, definindo "Valor Fixo" como a opção padrão para evitar erros.
- **Lógica de Sincronização de Modelos Corrigida:**
  - A sincronização de modelos agora usa a API da Meta como a única "fonte da verdade". Modelos que existem localmente mas não na Meta são automaticamente excluídos.
  - A associação de modelos foi corrigida para usar o `wabaId` em vez do `connectionId`, garantindo que todas as conexões de uma mesma conta compartilhem os mesmos modelos.

### Corrigido
- **Bug Crítico de Envio de Campanhas:** Corrigido um erro que impedia o envio de campanhas de WhatsApp quando elas utilizavam variáveis dinâmicas (mapeadas para campos de contato). A lógica de substituição de variáveis agora funciona corretamente.
- **Erro de Referência (`AlertDialogTrigger not defined`):** Resolvida uma falha de compilação na página de Conexões causada pela falta de uma importação no componente.

### Documentação
- **Atualização do `CONSTITUICAO_PROJETO.md`:** Adicionado o "Caso #011", que detalha a arquitetura final do sistema de envio de campanhas e a importância de centralizar a lógica de comunicação com APIs externas.

## [1.11.0] - 2024-07-29

### Corrigido
- **Resolução de Erros de Build (Compilação):**
  - Corrigido um erro de `build` (`Dynamic server usage`) ao adicionar a diretiva `export const dynamic = 'force-dynamic';` às rotas de API (`/api/v1/campaigns`, `/api/v1/contacts`, `/api/v1/leads`, `/api/v1/company/credentials`) que utilizam parâmetros de busca, garantindo que sejam sempre renderizadas dinamicamente.
  - Corrigido um erro de `build` (`Cannot find module 'autoprefixer'`) ao adicionar a dependência `autoprefixer` que estava em falta no `package.json`.
  - Corrigido um problema em que os estilos do Tailwind CSS não eram aplicados na versão de produção (`next start`) ao converter o ficheiro de configuração `tailwind.config.ts` para `tailwind.config.js`, garantindo a compatibilidade com o processo de build.
- **Correção de Erros de Serialização de Props:**
  - Resolvidos múltiplos erros de compilação `TS71007` ("Props must be serializable") ao refatorar a comunicação entre componentes. Foram removidas as props de função (`onUpdate`, `onImportCompleted`, `onUpdateLeads`, `onMediaSelect`, `onSaveSuccess`) que eram passadas para componentes de cliente, alinhando o código com as regras do Next.js App Router.
- **Correção de Erros de Tipagem:**
  - Resolvido um erro de tipo `TS2322` onde a propriedade opcional `status` no tipo `AppointmentHistoryItem` causava uma falha de compilação. A propriedade foi tornada obrigatória e os dados de exemplo (`mock data`) foram atualizados para refletir a nova estrutura.
- **Correção de Layout (Z-index):**
  - Resolvido um bug visual onde o esqueleto de carregamento (placeholder) da página era renderizado atrás do menu lateral. O `SessionProvider` foi refatorado para garantir que a tela de carregamento respeite a mesma estrutura de layout da aplicação principal.

### Modificado
- **Documentação do Projeto Atualizada:**
  - O `CHANGELOG.md` foi atualizado para a versão `1.11.0`, documentando as correções críticas de build e tipagem.
  - O ficheiro `CONSTITUICAO_PROJETO.md` foi atualizado com o "Caso #010", detalhando a causa e a solução para os erros de `build` relacionados com a renderização dinâmica, para consulta futura.

## [1.10.0] - 2024-07-29

### Adicionado
- **Integração com Gateway de SMS `seven.io`:**
  - Adicionado suporte completo para o envio de campanhas de SMS através do provedor `seven.io`.
  - A lógica de backend em `POST /api/v1/campaigns/sms` e `GET /api/v1/campaigns/trigger` agora inclui um "adapter" para a API da `seven.io`, formatando o payload (`to`, `text`, `from`) e adicionando o cabeçalho de autenticação `X-Api-Key`.
  - O frontend, no componente `SmsGatewaysManager`, foi atualizado para incluir a `seven.io` como uma opção selecionável no formulário de criação de gateways.
- **Documentação Abrangente do Projeto:**
  - O ficheiro `CHANGELOG.md` foi atualizado com a nova versão `1.10.0`, documentando a integração com o gateway `seven.io`.
  - O `README.md` foi revisado para incluir a `seven.io` na lista de tecnologias e provedores de SMS suportados, garantindo que a documentação principal reflita as capacidades atuais da aplicação.
  - O ficheiro `CONSTITUICAO_PROJETO.md` foi auditado e atualizado para incluir o "Caso #009", detalhando as lições aprendidas com a resolução dos problemas em cascata na funcionalidade de campanhas SMS.
- **Layout Responsivo do Menu de Configurações:**
  - Corrigido um bug de layout no menu de abas da página de Configurações (`src/app/(main)/settings/page.tsx`), garantindo que os itens quebrem a linha corretamente em ecrãs de telemóvel ao ajustar as classes de grid do Tailwind CSS.

## [1.9.0] - 2024-07-28

### Adicionado
- **Envio Forçado de Campanhas Agendadas:**
  - Adicionado o botão "Forçar Envio Agora" no menu de cada campanha com status "Agendada".
  - Criado o endpoint de API `POST /api/v1/campaigns/[campaignId]/trigger` para iniciar o envio de uma campanha específica sob demanda, reutilizando a lógica do cron job para garantir consistência.
- **Tabela de Logs de Entrega de SMS (`sms_delivery_reports`):**
  - Adicionada a nova tabela `sms_delivery_reports` ao schema do Drizzle para registar o status de cada mensagem individual enviada via SMS.
  - Implementada a lógica nas APIs de envio de SMS (`/api/v1/campaigns/sms` e `/api/v1/campaigns/trigger`) para inserir um registo para cada contato após a tentativa de envio ao gateway.
- **Relatório de Campanhas SMS:**
  - A página de relatório (`/campaigns/[campaignId]/report`) agora diferencia campanhas de SMS e WhatsApp.
  - Para campanhas SMS, a página exibe a mensagem enviada e uma lista de todos os contatos destinatários, buscando os dados das listas de contatos associadas. Os KPIs de entrega e leitura são ocultados, pois não são aplicáveis no momento.
- **Reestruturação das Rotas de Relatório:**
  - A rota do relatório foi alterada para `/campaigns/[channel]/[campaignId]/report` para melhor organização e clareza, incluindo o tipo de canal (`sms` ou `whatsapp`) na URL.

### Corrigido
- **Integração com API do Gateway Witi:**
  - Corrigido um erro crítico "405 Method Not Allowed" ao refatorar a função de envio `sendWithWiti` para usar o endpoint e o formato de payload corretos (`https://sms.witi.me/sms/send.aspx`).
  - Corrigida a lógica de formatação de datas: o campo `DataAgendamento` agora é enviado com o formato `yyyy-MM-dd HH:mm:ss` para campanhas agendadas e como uma string vazia para envios imediatos, resolvendo erros de agendamento.
- **Relatórios de Campanha com Erro 404:**
  - Resolvido um erro 404 persistente na página de relatórios. O problema foi causado pela busca de dados em uma lista estática (`mock data`). A página foi refatorada para buscar os dados de uma campanha específica dinamicamente através de uma nova rota de API (`GET /api/v1/campaigns/[campaignId]`), permitindo a visualização de relatórios para qualquer campanha.
- **KPIs Vazios no Relatório:**
  - Corrigido um bug onde os KPIs de campanha (Enviados, Entregues, etc.) apareciam zerados. A API foi atualizada para realizar uma contagem real dos registos na tabela `sms_delivery_reports` usando subconsultas SQL, garantindo que os totais sejam exibidos corretamente.
- **Conflito de Rota `/campaigns`:**
  - Resolvido um conflito de rota que causava erro 404 na página principal de campanhas. A pasta foi renomeada para `src/app/(main)/campanhas` e todos os links e importações foram atualizados para refletir a nova rota, evitando a colisão com a rota dinâmica de relatórios.

## [1.8.0] - 2024-07-27

### Adicionado
- **Página de Diagnóstico do Sistema (`/testes`):**
  - Criada uma nova rota (`/testes`) isolada e sem autenticação para administradores, que verifica o status de conexões vitais do sistema.
  - Otimizada para fazer uma única chamada de API ao backend, que por sua vez testa as conexões.
  - **Teste de Conexão com PostgreSQL:** Confirma se a aplicação consegue se conectar ao banco de dados principal.
  - **Teste de Conexão com Redis:** Envia um comando `PING` para o servidor Redis para validar a conectividade.
  - **Teste de Conexão com a API da Meta:** Realiza uma chamada de teste à API da Meta usando uma conexão ativa para verificar a validade do token.
- **Dashboard Interativo e KPIs Abrangentes:**
  - Adicionado um seletor de período (`DateRangePicker`) que permite filtrar os dados do dashboard.
  - Adicionados novos cartões de KPI para uma visão geral mais completa, incluindo "Valor Total em Leads", "Total de Contatos", "Total de Mensagens Enviadas" e "Atendimentos Pendentes".
  - Implementado um novo gráfico de "Tendência de Atendimentos" (Iniciados vs. Resolvidos).
  - Adicionada uma nova tabela com o "Ranking de Atendentes" por performance.
- **Melhorias de UI/UX no Cabeçalho Principal:**
  - O avatar do utilizador agora exibe a primeira letra do seu nome em vez de uma imagem estática.
  - Adicionado um ícone de sino com um painel de notificações (mock).
  - O fundo do cabeçalho foi ajustado para corresponder ao fundo do conteúdo principal, criando uma aparência visualmente integrada.

### Corrigido
- **Resolução Final de Erros de Sessão:**
  - Corrigido um problema crónico em que a sessão de desenvolvimento falhava no arranque. A causa raiz foi identificada como uma "race condition" nos scripts de inicialização, onde o "seed" do banco de dados era executado antes da conclusão das migrações.
  - Os scripts `push-db.ts` e `seed-drizzle.ts` foram refatorados para garantir uma execução estritamente sequencial, resolvendo o problema de forma definitiva.
  - A gestão da conexão do Drizzle em `lib/db/index.ts` foi aprimorada para ser um singleton robusto, evitando múltiplas conexões instáveis em ambiente de desenvolvimento com "hot-reloading".
- **Otimização de Performance Crítica da Página Kanban:**
  - Corrigido um problema grave de performance na página `/kanban` que causava o seu congelamento. O problema era causado por um "N+1 query problem" na API, que executava múltiplas consultas ao banco de dados em loop.
  - A API `/api/v1/kanbans` foi refatorada para usar uma única e eficiente consulta SQL com `LEFT JOIN` e `GROUP BY`, reduzindo dezenas de chamadas ao banco para apenas uma.
- **Correção da Barra de Rolagem (Scroll) no Kanban:**
  - Resolvido um bug persistente onde a barra de rolagem vertical não aparecia em colunas do Kanban com muitos cards.
  - A estrutura de layout da página do funil (`[funnelId]/page.tsx`) e do componente `kanban-view.tsx` foi corrigida para usar uma altura explícita (`h-[calc(100vh-...)]`) e `min-h-0`, garantindo que o componente `ScrollArea` funcione corretamente.
- **Melhora de UX na Gestão de Tags:**
  - Implementada a atualização otimista na adição/remoção de tags nos cards do Kanban. A interface do utilizador agora reflete a alteração instantaneamente, com a chamada à API a ocorrer em segundo plano, eliminando a necessidade de recarregar todos os dados.
- **Comportamento da Barra de Rolagem Principal:** Corrigido o comportamento da barra de rolagem do layout principal. Agora, ela abrange toda a altura da página (excluindo o menu lateral), em vez de apenas a área de conteúdo, proporcionando uma experiência de navegação mais natural e profissional.
- **Resolução de Erros de Hidratação na Página de Testes:** A página de testes foi refatorada para usar um componente de cliente (`'use client'`) com `<Suspense>`, eliminando os conflitos entre a renderização do servidor e do cliente que causavam falhas na hidratação.

### Dependências
- **Adicionado `ioredis`:** Adicionada a biblioteca `ioredis` ao `package.json` para permitir a conexão com o servidor Redis.

## [1.7.0] - 2024-07-26

### Adicionado
- **Documentação Abrangente do Projeto:**
  - O ficheiro `README.md` foi significativamente melhorado para refletir com precisão todas as funcionalidades atuais da aplicação, com descrições mais detalhadas e uma visão geral mais clara.
  - O `CHANGELOG.md` foi atualizado com uma nova entrada para a versão `1.7.0`, documentando esta própria atualização para manter a rastreabilidade.
- **Lições Aprendidas com o Drizzle ORM:**
  - Uma nova secção, "Caso #007", foi adicionada ao ficheiro `CONSTITUICAO_PROJETO.md` para documentar permanentemente os desafios e as soluções encontradas ao lidar com as inserções em lote (`batch insert`) e as violações de unicidade no Drizzle. Isto serve como um guia crucial para evitar a repetição de erros no futuro.

### Modificado
- **Lógica de Importação de Contatos (Resolução Final):**
  - A API de importação em `/api/v1/contacts/import` foi completamente refatorada para resolver os erros de `Gateway Timeout (504)` e as falhas de inserção em lote (`batch insert`).
  - A estratégia de inserir contatos um a um foi revertida para a abordagem de inserção em lote (`db.insert().values([...])`), que é muito mais performante.
  - A causa raiz do erro de sintaxe SQL do Drizzle foi corrigida: a aplicação agora fornece valores explícitos para todas as colunas que têm um valor padrão no schema (como `createdAt` e `status`), em vez de esperar que o banco de dados os gere.
  - Foi adicionada uma camada de pré-validação com um `Set` em JavaScript para identificar e ignorar números de telefone duplicados *dentro do mesmo lote de CSV*, prevenindo erros de violação de chave única antes que eles cheguem ao banco de dados.
- **Depuração de API Aprimorada:**
  - O tratamento de erros na API de importação foi melhorado para fornecer feedback de depuração extremamente detalhado. Em caso de falha na transação, a API agora retorna não apenas a mensagem de erro do banco de dados, mas também a `linha exata do ficheiro CSV` que causou o problema e um marcador (`codeLocation`) que indica a secção exata do código backend onde a falha ocorreu.
- **Melhoria da Experiência do Utilizador (UX) na Importação:**
  - A tabela de contatos agora é atualizada automaticamente (`revalidação`) após uma importação bem-sucedida, garantindo que o utilizador veja os novos dados imediatamente, sem a necessidade de atualizar a página manualmente.
- **Sanitização de Dados Robusta:**
  - A função de limpeza de números de telefone foi aprimorada para ser mais flexível, removendo caracteres especiais de forma mais eficaz e preservando códigos de país (`+`), o que aumenta significativamente a taxa de sucesso na importação de ficheiros com formatos variados.

## [1.6.0] - 2024-07-26

### Adicionado
- **CRM Completo de Contatos:** Refatoração massiva da funcionalidade de Contatos para transformá-la num CRM robusto.
  - **Schema Extensivo:** O schema da tabela `contacts` no Drizzle foi expandido para incluir campos detalhados de CRM, como `email`, `avatarUrl`, e um endereço completo (`addressStreet`, `addressCity`, `addressState`, etc.).
  - **CRUD de Contatos no Backend:** Implementados endpoints de API RESTful em `/api/v1/contacts` para gerir o ciclo de vida completo dos contatos (Criar, Ler, Atualizar, Excluir).
  - **API de Importação de CSV:** Criado o endpoint `POST /api/v1/contacts/import` para a importação de contatos em massa, com lógica para mapeamento de colunas e atualização de registros existentes.
  - **Paginação e Filtros na API:** O endpoint `GET /api/v1/contacts` agora suporta paginação, ordenação e filtragem por tags e listas, garantindo a escalabilidade da funcionalidade.
- **UI Avançada para Gestão de Contatos:** A interface do utilizador foi significativamente melhorada para lidar com grandes volumes de dados.
  - **Paginação no Frontend:** Adicionados controlos de paginação à tabela de contatos, permitindo a navegação eficiente entre páginas.
  - **Filtros e Ordenação:** Implementados menus `Select` para permitir que o utilizador filtre contatos por tags e listas, e ordene os resultados por diferentes critérios.
  - **Criação de Contato "On-the-Fly":** O modal de criação de contatos agora inclui o componente `MultiSelectCreatable`, permitindo ao utilizador buscar e criar tags e listas em tempo real, sem sair do formulário.
  - **Tratamento de Erros Aprimorado:** Melhorada a experiência do utilizador com tratamento de erros específico para contatos duplicados (erro 409) e outras falhas de API, fornecendo feedback claro e acionável.

### Corrigido
- **Correção de Dependência em Falta (`cmdk`):** Adicionada a biblioteca `cmdk` ao `package.json`, resolvendo um erro de "Module not found" que impedia o funcionamento dos componentes de busca e seleção.
- **Layout Responsivo do Menu de Configurações:** Corrigido um bug de layout no menu de abas da página de Configurações, garantindo que os itens quebrem a linha corretamente em ecrãs de telemóvel.
- **Geração de Migração em Falta:** Corrigido um erro crítico onde as alterações no schema do Drizzle para a tabela `contacts` não tinham sido acompanhadas por um ficheiro de migração, impedindo a sua aplicação no banco de dados.

## [1.5.0] - 2024-07-25

### Modificado
- **Migração de ORM: Prisma para Drizzle:**
  - Substituído completamente o Prisma ORM pelo Drizzle ORM para resolver problemas persistentes de conexão e ambiente.
  - Removidas todas as dependências do Prisma (`prisma`, `@prisma/client`).
  - Adicionadas e configuradas as novas dependências (`drizzle-orm`, `drizzle-kit`, `postgres`).
  - Recriado o schema da base de dados e os scripts de seed/migração para serem compatíveis com o Drizzle.
- **Refatoração do Acesso a Dados:**
  - Atualizadas todas as chamadas à base de dados na aplicação (Server Actions, Contextos) para usar a sintaxe e o cliente do Drizzle.
- **Adiamento Estratégico da Funcionalidade de IA:**
  - Removidas todas as dependências do Genkit (`@genkit-ai/core`, `@genkit-ai/googleai`) para simplificar o projeto e focar no MVP.
  - Removido todo o código relacionado a fluxos de IA e a lógica de personalização de mensagens.
  - Criado o ficheiro `IA_DOCS.md` para documentar a decisão e preservar o plano de implementação para o futuro.

### Corrigido
- **Correção de Erros de `build`:** Resolvidos múltiplos erros de compilação relacionados à importação e inicialização incorreta do Genkit.

## [1.4.1] - 2024-08-05

### Corrigido
- **Resolução de Múltiplos Erros de Instalação (`npm install`):**
  - Corrigido um ciclo de erros `ETARGET` e `ERESOLVE` ao remover dependências de IA (`@genkit-ai/next`) que eram incompatíveis com a versão 14 do Next.js do projeto, estabilizando a instalação.
- **Estabilização da Conexão com a Base de Dados (PostgreSQL):**
  - Resolvido o erro persistente `ECONNRESET` que impedia o arranque do servidor. O problema foi causado por configurações de conexão do Prisma incorretas (específicas para o Neon DB) que foram removidas e substituídas pela configuração padrão para um ambiente PostgreSQL local (Docker).
- **Correção da Configuração do Next.js:**
  - Corrigido um erro de arranque do servidor (`Configuring Next.js via 'next.config.ts' is not supported`) ao renomear `next.config.ts` para `next.config.mjs`.
  - Adicionado o domínio `placehold.co` à configuração de imagens do `next.config.mjs` para resolver erros de `next/image` de "hostname não configurado".

## [1.4.0] - 2024-08-05

### Adicionado
- **Integração com PostgreSQL e Prisma ORM:**
  - Substituída a lógica de seeding do Firestore por uma base de dados PostgreSQL robusta, gerida pelo Prisma ORM.
  - Criado o esquema inicial do Prisma com os modelos `Company` e `User`, estabelecendo a fundação para a arquitetura de dados relacional.
  - Implementado o driver adapter do Neon para garantir a compatibilidade da conexão do Prisma em ambientes de cloud.
- **Processo de Desenvolvimento Estabilizado:**
  - Criado um script de arranque (`scripts/dev-start.js`) que executa automaticamente as migrações da base de dados (`prisma migrate dev`) antes de iniciar o servidor do Next.js, garantindo que a base de dados esteja sempre sincronizada com o esquema.
- **Seeding Idempotente no PostgreSQL:**
  - O script de seeding foi refatorado para usar o Prisma, inserindo os dados iniciais de desenvolvimento no PostgreSQL de forma segura, verificando a existência de dados antes de os criar.
- **Autenticação Híbrida (Firebase Auth + PostgreSQL):**
  - O `SessionProvider` foi atualizado para obter os dados do utilizador (nome, email) a partir do PostgreSQL, usando o UID do Firebase como chave de ligação, exibindo dinamicamente as informações do utilizador logado.

### Removido
- **Dependências do Firestore para Seeding:** Removidos os pacotes e a lógica de seeding que dependiam diretamente do Firestore (`firebase-admin`), simplificando o processo de arranque.

## [1.3.1] - 2024-08-04

### Corrigido
- **Correção Massiva de Tipagem:** Realizada uma revisão completa e correção de tipos em toda a aplicação para resolver múltiplos erros de compilação (`build`) do Next.js e TypeScript.
- **Rota de Atendimentos:** A página `/atendimentos` foi refatorada para usar a fronteira de `Suspense` do React, corrigindo o erro de `build` "useSearchParams() should be wrapped in a suspense boundary".
- **Componentes de Rota Dinâmica:** As páginas de rotas dinâmicas (ex: `[contactId]`) foram padronizadas para garantir a compilação correta, eliminando conflitos de tipo com os ficheiros gerados pelo Next.js.
- **Acessibilidade do Menu:** Corrigido um problema de acessibilidade no menu móvel (`Sheet`), adicionando um `SheetTitle` para garantir a compatibilidade com leitores de ecrã.

## [1.3.0] - 2024-08-04

### Adicionado
- **Gestão de Funis Kanban:**
  - Criada a página `/kanban` como um painel central para visualizar e gerir múltiplos funis de venda/atendimento.
  - Implementado um formulário em modal para a criação de novos funis, com etapas (colunas) dinâmicas, reordenáveis com "arrastar e soltar".
  - Criada a página de visualização de funil individual (`/kanban/[funnelId]`), com KPIs, filtros e um quadro Kanban com rolagem horizontal.
- **Integração de Leads no Chat:** Adicionada a funcionalidade "Adicionar a um Funil" no painel de detalhes do contato na página de "Atendimentos", permitindo criar um lead diretamente da conversa.

### Corrigido
- **Bug de Arrastar e Soltar (Drag-and-Drop):** Corrigido o bug visual onde o elemento arrastado "escapava" dos limites do modal durante a reordenação de etapas do funil.

## [1.2.0] - 2024-08-03

### Adicionado
- **Funcionalidade de Webhooks de Saída:** Adicionada uma nova aba "Webhooks" na página de "Configurações" para permitir que os utilizadores notifiquem sistemas externos sobre eventos na aplicação (ex: criação de um novo contato).

### Modificado
- **Refatoração Mobile-First da Página de Atendimentos:** A página `/atendimentos` foi completamente reestruturada para garantir uma experiência de utilizador impecável em dispositivos móveis.
  - A vista inicial em telemóveis agora mostra apenas a lista de conversas a ecrã inteiro.
  - A pré-visualização da última mensagem foi limitada a uma única linha, corrigindo quebras de layout.
  - A navegação para a vista de chat agora é fluida e ocupa todo o ecrã, com um botão "Voltar" funcional.
  - O campo de input de mensagem no chat foi corrigido para permanecer fixo na parte inferior do ecrã durante o uso.
- **Consistência de Layout dos Títulos:** O alinhamento dos cabeçalhos das páginas "Atendimentos" e "Kanban" foi corrigido para corresponder ao padrão de alinhamento à esquerda do resto da aplicação, garantindo consistência visual.

### Adicionado
- **Visualização Kanban:** Adicionada uma visualização em painel Kanban na página de "Atendimentos" para gerenciamento de fluxos de conversa.
- **Painel de Detalhes do Contato:** Implementado um painel lateral na tela de chat que exibe informações contextuais do cliente, como tags e notas, evitando que o atendente precise sair da tela.
- **Visualização em Grade para Contatos:** Adicionada uma alternativa de visualização em formato de "cards" na página de "Contatos".
- **Ações em Massa para Contatos:** Implementada a funcionalidade de selecionar múltiplos contatos na tabela para aplicar ações em massa (ex: adicionar tag, excluir).

### Modificado
- **Refinamento da UI da Página de Atendimentos:** A barra de ferramentas de filtros na "Caixa de Entrada" foi redesenhada para ser mais espaçosa e responsiva.
- **Melhora de Feedback Visual:** Adicionada uma notificação "toast" de sucesso ao salvar alterações na página de perfil do usuário.
- **Otimização da Responsividade:** Componentes complexos como tabelas e formulários foram revisados para garantir melhor usabilidade em dispositivos móveis.
- **Reorganização do Menu:** Os itens do menu principal foram reordenados para refletir a prioridade e frequência de uso das funcionalidades, melhorando a navegação.
- **Refatoração da Página de Campanhas:** O layout da página de "Campanhas" foi completamente redesenhado, substituindo a tabela por uma grade de "cards" mais moderna e visual.

## [1.1.0] - 2024-08-02

### Adicionado
- **Página de Marketing (Landing Page):** Criada uma landing page completa e responsiva para apresentar o produto, com seções de funcionalidades, preços, testemunhos e contato.
- **Páginas de Autenticação:** Implementadas as páginas de Login e Cadastro (`/login`, `/register`) com um design moderno de duas colunas, incluindo validação de formulário e opções de login social.
- **Seletor de Tema:** Adicionado um seletor de tema (Claro, Escuro, Sistema) flutuante nas páginas de marketing e autenticação para melhorar a experiência do usuário.
- **Documentação Técnica:** Criado o arquivo `FRONTEND_DOCS.md` com detalhes sobre a arquitetura do frontend, tecnologias e convenções.

### Modificado
- **Redesenho Completo do Layout Principal:** O layout do dashboard foi modernizado, adotando uma estrutura com cabeçalho superior fixo e menu lateral, abandonando o layout antigo.
- **Atualização da Paleta de Cores:** A paleta de cores do dashboard foi atualizada para usar um verde vibrante (#10B981) como cor primária e novos tons de cinza/azul para os fundos, melhorando o contraste e a estética.
- **Componentes de Layout:** Os componentes `AppHeader` e `AppSidebar` foram completamente redesenhados para se alinharem ao novo layout de dashboard.

## [1.0.0] - 2024-08-01

### Adicionado
- **Criação Inicial:** Projeto criado com Next.js, TypeScript, Tailwind CSS e ShadCN UI.
- **Layout Principal:** Estrutura de layout com uma barra lateral de navegação e conteúdo principal.
- **Fluxo de IA:** Configuração do Genkit e fluxo inicial para personalização de mensagens.
- **Página de Contatos e Perfil:** Tela para listar contatos e visualizar um perfil detalhado com histórico de atendimentos, tags e notas.
- **Página de Campanhas:** Tabela para visualização e gerenciamento de campanhas. Inclui modais para criação, duplicação e exclusão.
- **Relatório de Campanhas:** Página de relatório detalhado para cada campanha, com estatísticas e status de envio por contato.
- **Página de Modelos:** Grade visual para listar modelos de mensagem. Inclui um fluxo de criação de modelos passo a passo com pré-visualização em tempo real.
- **Dashboard:** Painel inicial com cartões de KPI, gráficos de desempenho, atalhos rápidos, lista de campanhas ativas e atendimentos pendentes.
- **Página de Gerenciamento de Equipe:** Tela para convidar, editar e remover usuários da plataforma.
- **Página de Conexões:** Gerenciador para adicionar e configurar múltiplas conexões da API do WhatsApp.
- **Página de Configuração de IA:** Seção centralizada com abas para gerenciar "Personas de IA", incluindo comportamento, base de conhecimento e regras de automação.
- **Página de Roteamento:** Tabela para direcionar atendimentos de cada conexão para uma Persona de IA específica ou para atendimento manual.
- **Página de Atendimentos:** Interface com visualização em "Caixa de Entrada" (inbox) e "Kanban" para gerenciamento de conversas em tempo real.
- **Página de Perfil do Usuário:** Tela para o usuário gerenciar suas próprias informações pessoais, senha e preferências.
