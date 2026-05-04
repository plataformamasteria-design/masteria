# Constituição do Projeto ZAP Master - Regras para a IA

**Atenção, Agente de IA (Firebase Studio):** Este documento contém as regras e diretrizes invioláveis para o desenvolvimento do projeto ZAP Master. Você DEVE consultar e aderir a estas regras antes de executar qualquer comando de criação ou modificação de código. O objetivo é garantir a estabilidade, consistência e qualidade do projeto.

## 1. Regras Invioláveis (NUNCA QUEBRAR)
Estas regras protegem a fundação do projeto. A violação destas regras resulta em falhas críticas.

### Regra 1.1: Ficheiros de Ambiente (.env, .env.local)
- **NUNCA** apague ou sobrescreva estes ficheiros.
- Se precisar de adicionar novas variáveis de ambiente, **APENAS ADICIONE NOVAS LINHAS** ao final do ficheiro.

### Regra 1.2: Ficheiros de Configuração do Next.js
- **NÃO MODIFIQUE** os ficheiros `next.config.mjs`, `tsconfig.json`, e `tailwind.config.js` a menos que seja explicitamente instruído numa tarefa de reparação de emergência. A configuração atual está estável e funcional.

### Regra 1.3: Estrutura do App Router (`/src/app`)
- **NÃO ALTERE** a estrutura de pastas raiz do App Router. A estrutura atual com `layout.tsx` na raiz, o grupo `(main)` para o painel e `page.tsx` para a landing page é a configuração correta e não deve ser modificada.

## 2. Diretrizes Gerais de Desenvolvimento
Estas diretrizes garantem a qualidade e a consistência da experiência do utilizador.

### Diretriz 2.1: Responsividade Primeiro (Mobile-First)
- Todo e qualquer componente ou página deve ser projetado e testado primeiro para ecrãs de telemóvel. A experiência em desktop é uma extensão da experiência móvel, e não o contrário.
- Use os prefixos responsivos do Tailwind CSS (`sm:`, `md:`, `lg:`) extensivamente.
- Tabelas largas **DEVEM** ser transformadas em listas de cards em ecrãs pequenos.

### Diretriz 2.2: Consistência Visual
- Adira estritamente à paleta de cores já definida para os temas claro e escuro.
- **Tema Claro:** Fundo branco, textos em cinza escuro, destaque em verde (`#10B981`).
- **Tema Escuro:** Fundos em cinza carvão (`#1b1c1d`, `#282a2c`), textos claros, destaque em verde (`#10B981`).
- Todos os componentes (botões, cards, inputs) devem seguir o mesmo estilo visual já estabelecido.

### Diretriz 2.3: Acessibilidade e UX
- Garanta bom contraste de cores, especialmente para textos.
- Todos os elementos clicáveis devem ter uma área de toque mínima de 44x44 pixels.
- O menu lateral deve fechar-se automaticamente em telemóveis após a navegação.

## 3. Registro de Soluções (Problemas "Cabeludos" Resolvidos)

### Caso #020: Erro de Hidratação por Formatação de Datas
- **Sintoma:** Ocorria um erro `Error: Text content did not match. Server: "..." Client: "..."` em múltiplos componentes que exibiam datas relativas (ex: "há 5 minutos").
- **Causa Raiz Identificada:** A função `formatDistanceToNow` da biblioteca `date-fns` era chamada diretamente durante a renderização no servidor. Como o servidor e o navegador do cliente podem estar em fusos horários diferentes, o texto gerado era diferente (ex: "9 de agosto" no servidor vs. "8 de agosto" no cliente), causando a falha de hidratação no Next.js.
- **Solução Implementada (Princípio Unificado):**
    1.  **Criação de um Componente de Cliente `RelativeTime`:** Um pequeno componente React foi criado para isolar a lógica de formatação de data.
    2.  **Renderização Atrasada com `useEffect`:** Dentro do componente `RelativeTime`, os hooks `useState` e `useEffect` foram utilizados. O componente renderiza inicialmente um *placeholder* (esqueleto de carregamento) no servidor.
    3.  **Formatação Apenas no Cliente:** A função `formatDistanceToNow` só é chamada dentro do `useEffect`, que é executado apenas no navegador, após a página ter sido "hidratada". O resultado é então guardado no estado, o que aciona uma nova renderização, agora com a data corretamente formatada, já no ambiente do cliente.
    4.  **Aplicação nos Componentes Afetados:** Este novo componente `RelativeTime` foi aplicado nos locais problemáticos (`/components/atendimentos/conversation-list.tsx` e `/components/dashboard/pending-conversations.tsx`), resolvendo o problema de forma definitiva e garantindo uma experiência de utilizador consistente.

### Caso #019: Falha de Deploy ("Failed to publish app") por Conflito de Configuração
- **Sintoma:** O deploy da aplicação falhava no último passo ("Publishing"), exibindo o erro genérico "Failed to publish app", mesmo após o processo de `build` ter sido concluído com sucesso.
- **Causa Raiz Identificada:** Um conflito de configuração no ficheiro `firebase.json`. O ficheiro continha simultaneamente uma secção `hosting.frameworksBackend` (usada por frameworks web no Firebase Hosting tradicional) e uma secção `apphosting` (a nova configuração para o App Hosting). Esta duplicidade criava uma ambiguidade para as ferramentas de deploy do Firebase, que não conseguiam determinar qual configuração de backend aplicar, causando a falha na publicação.
- **Solução Implementada:** A solução foi reestruturar o `firebase.json` para usar exclusivamente a configuração moderna e correta do App Hosting. Isto envolveu:
    1.  **Remoção da Configuração Legada:** A secção `frameworksBackend` foi completamente removida de dentro do objeto `hosting`.
    2.  **Centralização na Configuração do App Hosting:** Toda a configuração do backend, incluindo o mapeamento das variáveis de ambiente (`secretEnv`), foi consolidada dentro do objeto `apphosting.backends`. Isto eliminou a ambiguidade e alinhou o projeto com a estrutura de configuração esperada pelo Firebase App Hosting, resolvendo o erro de publicação.

### Caso #018: Correção Definitiva de Autenticação (Dev vs. Produção no Firebase Hosting)
- **Sintoma:** O login funcionava perfeitamente no ambiente de desenvolvimento local, mas em produção (Firebase Hosting) o utilizador era redirecionado para a página de login em um loop infinito (`ERR_TOO_MANY_REDIRECTS`) após inserir as credenciais corretas.
- **Causa Raiz Identificada:** Uma combinação de dois fatores críticos no ambiente de produção do Firebase Hosting:
    1.  **Cache de Cookies:** O Firebase otimiza a entrega de conteúdo através de cache. Por padrão, ele não invalida a cache da página com base em cookies, o que fazia com que o servidor visse uma versão antiga da página (sem o cookie de sessão), mesmo após o login ter definido o cookie com sucesso no browser do cliente.
    2.  **Nome do Cookie de Sessão:** O Firebase App Hosting tem um comportamento especial para o cookie chamado `__session`. Quando presente, o Firebase trata-o de forma diferente, garantindo que ele seja corretamente propagado e possa ser usado para invalidar a cache, se configurado para isso. O nome `session_token` não recebia este tratamento especial.
- **Solução Implementada (Arquitetura Unificada e Robusta):**
    1.  **Estratégia de Cookie Duplo:** A rota de login (`/api/v1/auth/login`) foi modificada para definir **dois cookies** com o mesmo token JWT: `__session` (para compatibilidade com o Firebase) e `session_token` (como um fallback robusto). Ambos foram configurados com as melhores práticas de segurança (`httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`).
    2.  **Leitura Prioritária de Cookies:** Tanto o `middleware.ts` quanto a função `getUserSession` em `actions.ts` foram atualizados para tentar ler o cookie `__session` primeiro. Se não for encontrado, eles tentam ler o `session_token`. Isto garante que a aplicação funcione corretamente em qualquer ambiente.
    3.  **Desativação Explícita de Cache:** Para resolver o problema de cache do lado do servidor, as diretivas `export const dynamic = 'force-dynamic'` e `export const fetchCache = 'force-no-store'` foram adicionadas ao topo do ficheiro de layout principal (`src/app/(main)/layout.tsx`). Isto força o Next.js a renderizar a página dinamicamente em cada requisição, garantindo que o estado mais recente do cookie seja sempre lido no servidor.
    4.  **Garantia de Envio de Credenciais:** A chamada `fetch` no componente de login do cliente (`/login/page.tsx`) foi garantida para incluir a opção `credentials: 'include'`, assegurando que o browser envie os cookies em todas as chamadas à API.

### Caso #017: Uso de Dados Reais de Sessão em Ações do Utilizador
- **Sintoma:** Ações como arquivar uma conversa ou enviar uma mensagem eram registadas no sistema com um ID de utilizador genérico e estático (ex: `user_system_placeholder`) em vez do ID real do atendente que executou a ação, tornando impossível a rastreabilidade.
- **Causa Raiz Identificada:** Falha na implementação das rotas de API correspondentes, que não continham a lógica para extrair o ID do utilizador autenticado a partir do token de sessão (JWT) guardado nos cookies.
- **Solução Implementada (Princípio Unificado):**
    1.  **Criação do Utilitário `getUserIdFromSession`:** Uma função centralizada foi criada em `src/app/actions.ts` para ler e verificar o JWT a partir dos `cookies` e retornar de forma segura o `userId` contido no payload do token.
    2.  **Aplicação em Todas as Rotas Relevantes:** Todas as rotas de API que representam uma ação de um utilizador (ex: `POST /api/v1/conversations/[id]/archive`, `POST /api/v1/conversations/[id]/messages`) foram modificadas para chamar esta nova função no início do seu fluxo de execução.
    3.  **Atribuição Correta:** O `userId` retornado pela função foi então utilizado para preencher os campos corretos no banco de dados (como `archivedBy` na tabela `conversations` e `senderId` na tabela `messages`), garantindo que todas as ações sejam corretamente atribuídas ao utilizador que as realizou.

### Caso #016: Resolução Definitiva do Layout de Chat (Scroll e Input Fixo)
- **Sintoma:** Em conversas com muitas mensagens, a lista de mensagens crescia indefinidamente, empurrando o campo de input de texto para fora da área visível do ecrã, em vez de criar uma barra de rolagem interna.
- **Causa Raiz Identificada:** Um erro clássico de layout em CSS. O componente `ActiveChat` e os seus contêineres pais não tinham uma altura definida. Um contêiner com `overflow-y: auto` (ou uma `ScrollArea`) só pode funcionar se o seu próprio tamanho for limitado por um pai com altura explícita (ex: `h-full` ou `h-screen`). Sem isso, o `div` das mensagens simplesmente cresce para acomodar todo o seu conteúdo, empurrando os elementos seguintes.
- **Solução Implementada (Hierarquia de Altura Explícita):** A solução foi aplicar uma altura definida de cima para baixo em toda a árvore de componentes:
    1.  **Página Principal (`/atendimentos/page.tsx`):** O `div` raiz recebeu a classe `h-full` para ocupar toda a altura do layout principal.
    2.  **Componente Cliente (`/atendimentos/atendimentos-client.tsx`):** O `div` raiz deste componente também recebeu `h-full` e foi transformado num `flex flex-col` para que os seus filhos pudessem usar o espaço de altura.
    3.  **Componente de Grid (`/atendimentos/inbox-view.tsx`):** O `div` que envolve o `ActiveChat` recebeu a classe `min-h-0` para garantir que ele não ultrapasse o tamanho do seu contêiner flex pai.
    4.  **Componente de Chat (`/atendimentos/active-chat.tsx`):** O layout foi estruturado com `flex flex-col h-full`. O `div` que contém a `ScrollArea` recebeu a classe `flex-1 min-h-0` (para crescer e ocupar o espaço disponível, mas não mais que isso), e o `footer` com o input permaneceu como um elemento de tamanho fixo (`flex-shrink-0`), garantindo que ele nunca seja empurrado para fora da tela.

### Caso #015: Lógica de Canonicalização de Números de Telefone Brasileiros
- **Sintoma:** Contatos eram duplicados no sistema. Um contato cadastrado manualmente com o nono dígito (ex: +55 XX 9XXXX-XXXX) não era reconhecido quando o mesmo contato enviava uma mensagem via webhook, que a Meta entrega sem o nono dígito (ex: +55 XX XXXX-XXXX), levando à criação de um novo registo para o mesmo número.
- **Causa Raiz Identificada:** Falha em tratar as duas variações válidas de um mesmo número de celular brasileiro. A busca no banco de dados era feita apenas com o número recebido pelo webhook, sem verificar a sua forma alternativa (com o nono dígito).
- **Solução Implementada (Arquitetura de 3 Etapas):**
    1.  **Criação do Utilitário `getPhoneVariations`:** Uma função foi criada em `src/lib/utils.ts` para receber um número de telefone e retornar um *array* com todas as suas variações válidas (com e sem o nono dígito). Esta função é usada **exclusivamente para buscas**.
    2.  **Consulta Robusta com `inArray`:** No processador do webhook (`/api/webhooks/meta/...`), a consulta ao banco de dados foi modificada para usar o operador `inArray` do Drizzle. Em vez de `WHERE phone = '...'`, a consulta agora é `WHERE phone IN ('+55XX9...','+55XX...')`, garantindo que o contato seja encontrado independentemente de como foi salvo.
    3.  **Criação do Utilitário `canonicalizeBrazilPhone`:** Uma segunda função foi criada para definir o "formato de ouro" de um número. Esta função **sempre** retorna a versão com o nono dígito para celulares brasileiros. Ao criar um **novo contato** que não foi encontrado na busca, o sistema usa esta função para garantir que o número seja sempre persistido no formato canônico e completo, padronizando a base de dados.

### Caso #014: Erro de `build` por Renderização Dinâmica (`Dynamic Server Usage`)
- **Sintoma:** O processo de `build` falhava com o erro `Dynamic server usage: Route /api/... couldn't be rendered statically porque usou 'cookies'`.
- **Causa Raiz Identificada:** Durante o `build`, o Next.js tenta pré-renderizar o maior número possível de rotas como ficheiros estáticos para otimizar a performance. No entanto, algumas rotas de API usavam uma função (`getCompanyIdFromSession`) que, por sua vez, acedia aos `cookies` da requisição para verificar a sessão do utilizador. O objeto `cookies` não está disponível durante o `build` estático, pois ele só existe quando um pedido real é feito ao servidor, causando um conflito.
- **Solução Implementada:** Para resolver o problema, foi adicionada a diretiva `export const dynamic = 'force-dynamic';` em todos os ficheiros de rota da API (`route.ts`) que precisam de aceder à sessão do utilizador. Esta diretiva instrui explicitamente o Next.js a nunca tentar gerar estaticamente estas rotas, garantindo que elas sejam sempre renderizadas dinamicamente no servidor, onde o objeto `request` e os `cookies` estarão disponíveis.

### Caso #013: Ciclo Infinito de Renderização (`Maximum update depth exceeded`)
- **Sintoma:** O erro "Maximum update depth exceeded" ocorria consistentemente em componentes que utilizavam formulários ou seletores complexos (ex: `FunnelFormDialog`, `MultiSelectCreatable`).
- **Causa Raiz Identificada:** Uso incorreto do hook `useEffect`. Funções (como `form.reset` ou `fetchOptions`) ou objetos eram passados diretamente para o array de dependências do `useEffect`. Como a referência destas funções/objetos pode mudar a cada renderização, o `useEffect` era acionado em um ciclo infinito, onde ele mesmo causava a sua próxima execução.
- **Solução Implementada (Princípio Unificado):**
    1.  **Remoção de Funções/Objetos do Array de Dependências:** As funções e objetos complexos foram removidos dos arrays de dependências dos `useEffect`s.
    2.  **Dependência de Valores Primitivos:** Os `useEffect`s foram refatorados para depender apenas de valores primitivos (strings, booleans, numbers) que mudam de forma previsível (ex: `isOpen`, `inputValue`).
    3.  **Uso de `useCallback`:** Funções que precisam ser passadas como dependência para outros hooks foram envolvidas com `useCallback` para memorizar sua referência e evitar a recriação desnecessária, quebrando o ciclo de atualizações.
    4.  **Fluxo de Dados Unidirecional:** A comunicação entre componentes foi ajustada para seguir um fluxo de dados estritamente unidirecional (props para baixo, callbacks para cima), eliminando ciclos de feedback onde um componente filho atualizava o pai, que por sua vez atualizava o filho, causando o loop.

### Caso #012: Inconsistência de Nomenclatura entre Drizzle ORM e Código
- **Sintoma:** Erro de "column does not exist" durante uma consulta SQL, mesmo quando a coluna parecia estar corretamente definida no schema do Drizzle.
- **Causa Raiz Identificada:** O Drizzle ORM, por padrão, mapeia colunas definidas em `snake_case` no schema (ex: `file_size`) para propriedades em `camelCase` nos objetos que ele retorna (ex: `fileSize`). No entanto, ao construir consultas com `db.select()`, o código da aplicação tentava aceder a uma propriedade camelCase (`mediaAssets.fileSize`) que não existe diretamente no objeto de definição da tabela do schema, onde os nomes das colunas são mantidos em snake\_case (`mediaAssets.file_size`).
- **Solução Implementada:** A solução é sempre usar a propriedade `camelCase` que o Drizzle gera para o objeto da tabela no TypeScript. Ao construir a consulta `select`, deve-se mapear a propriedade `camelCase` do objeto para o seu próprio nome, como em `db.select({ fileSize: mediaAssets.fileSize, ... })`. Isto permite que o Drizzle lide com a tradução interna de `fileSize` (no código) para `file_size` (no SQL), resolvendo o erro de "coluna não existe". A regra é: no código TypeScript, use sempre `camelCase`.

### Caso #011: Arquitetura do Sistema de Envio de Campanhas
- **Sintoma:** O envio de campanhas era disperso, com lógica duplicada entre endpoints de criação (imediato) e cron jobs (agendado), e com uma camada de comunicação direta com as APIs externas (Meta, Witi) dentro da lógica de negócio, dificultando a manutenção e a depuração.
- **Causa Raiz Identificada:** Falta de uma camada de serviço centralizada e de um fluxo de processamento unificado para as campanhas. A lógica de envio estava acoplada diretamente às rotas da API.
- **Solução Implementada (Arquitetura de 2 Camadas):**
    1.  **Criação da Biblioteca de Serviço (`lib/facebookApiService.ts`):** Uma biblioteca de baixo nível foi criada para ser o **único** ponto de contato com a API da Meta. Ela é responsável apenas por montar o payload final e executar a chamada `fetch`, abstraindo a complexidade da comunicação direta.
    2.  **Criação do Orquestrador de Campanhas (`lib/campaign-sender.ts`):** Esta biblioteca de alto nível orquestra a lógica de negócio de uma campanha. Suas responsabilidades incluem:
        -   Buscar os dados da campanha no banco.
        -   Buscar a lista de contatos.
        -   Iterar sobre os contatos, resolvendo as variáveis (sejam dinâmicas ou fixas).
        -   Chamar a biblioteca de serviço (`facebookApiService` ou a lógica de um gateway de SMS) para cada mensagem individual.
        -   Atualizar o status final da campanha (ex: para "COMPLETED" ou "FAILED").
        -   Registrar logs de sucesso ou falha.
    3.  **Unificação dos Pontos de Entrada:** Todos os pontos de gatilho de campanha (criação imediata, cron job, disparo manual) foram refatorados para chamar as funções do orquestrador (`campaign-sender`), garantindo que **toda e qualquer campanha passe exatamente pelo mesmo fluxo de processamento**, eliminando a duplicação de código e tornando o sistema mais previsível e robusto.

### Caso #010: Erros de `build` por Renderização Dinâmica (`Dynamic Server Usage`)
- **Sintoma:** O processo de `build` falhava com o erro `Dynamic server usage: Route /api/... couldn't be rendered statically because it used 'request.url'`.
- **Causa Raiz Identificada:** Durante o `build`, o Next.js tenta gerar o maior número possível de rotas como ficheiros estáticos para otimizar a performance. No entanto, algumas rotas de API usavam `new URL(request.url)` para ler parâmetros de busca (query params). O objeto `request` não está disponível durante o `build` estático, pois ele só existe quando um pedido real é feito ao servidor, causando um conflito.
- **Solução Implementada:** Para resolver o problema, foi adicionada a diretiva `export const dynamic = 'force-dynamic';` em todos os ficheiros de rota da API (`route.ts`) que precisam de aceder ao objeto `request`. Esta diretiva instrui explicitamente o Next.js a nunca tentar gerar estaticamente estas rotas, garantindo que elas sejam sempre renderizadas dinamicamente no servidor, onde o objeto `request` estará disponível.

### Caso #009: Erros em Cascata na Funcionalidade de Campanhas SMS
- **Sintoma:** Uma série de erros interligados que impediam a criação, envio e visualização de relatórios de campanhas de SMS. Os sintomas incluíam:
    1.  Erro `405 Method Not Allowed` ao tentar enviar campanhas SMS.
    2.  Campanhas agendadas para datas incorretas (ex: 01/01/0001).
    3.  Erro `404 Not Found` ao tentar aceder à página de relatório de qualquer campanha.
    4.  KPIs de campanha (Enviadas, Entregues) sempre zerados.
    5.  Acesso à página principal de campanhas (`/campaigns`) gerava um erro 404 após a reestruturação da rota de relatórios.
- **Causa Raiz Identificada:** Uma combinação de múltiplos problemas:
    1.  **Implementação de API Incorreta:** A função de envio para o gateway `Witi` usava um endpoint e um formato de `payload` errados, desalinhados com a documentação do provedor.
    2.  **Lógica de Data Falha:** O código não diferenciava entre envios imediatos e agendados, enviando sempre um valor para `DataAgendamento`, o que causava erros na API do gateway.
    3.  **Dados Estáticos (Mock):** A página de relatório estava a buscar dados de uma lista estática, ignorando as campanhas criadas dinamicamente no banco de dados.
    4.  **Lógica de API Incompleta:** A API `GET /api/v1/campaigns/[campaignId]` retornava `0` para todos os KPIs, pois a lógica para contar os envios na tabela `sms_delivery_logs` não havia sido implementada.
    5.  **Conflito de Rotas no App Router:** A rota dinâmica `/campaigns/[channel]/...` entrou em conflito com a rota estática `/campaigns`, fazendo com que o Next.js tentasse tratar "campaigns" como um parâmetro `[channel]`.
- **Solução Implementada (em múltiplas etapas):**
    1.  **Refatoração da API Witi:** A função `sendWithWiti` foi corrigida para usar o endpoint `https://sms.witi.me/sms/send.aspx` e o `payload` correto.
    2.  **Lógica de Data Corrigida:** A função de envio agora só adiciona o campo `DataAgendamento` se a campanha tiver uma data de agendamento no futuro.
    3.  **Dinamização da Página de Relatório:** O componente foi refatorado para buscar os dados da campanha de forma dinâmica a partir da API `GET /api/v1/campaigns/[campaignId]`.
    4.  **Cálculo Real de KPIs:** A API foi atualizada para usar subconsultas SQL (`COUNT`) na tabela `sms_delivery_reports`, garantindo que os KPIs reflitam os dados reais de envio.
    5.  **Resolução do Conflito de Rotas:** A pasta de campanhas foi renomeada para `/campanhas`, e todos os links foram atualizados para `/campanhas` e `/campanhas/[channel]/...`, eliminando a ambiguidade para o App Router.

### Caso #008: Erro Crítico de Sessão e Falha de Arranque
- **Sintoma:** A aplicação não arrancava, exibindo um erro "Utilizador de desenvolvimento não encontrado" ou "Erro Crítico na Configuração da Sessão", mesmo com os dados corretos na base de dados.
- **Causa Raiz Identificada:** Uma combinação de dois problemas:
    1.  **Race Condition na Inicialização:** O script `push-db.ts` tentava executar a migração do schema e o "seed" (criação do utilizador) em paralelo, em vez de sequencialmente. Isso fazia com que o "seed" falhasse se a tabela de utilizadores ainda não tivesse sido criada.
    2.  **Gestão de Conexão Instável:** A lógica para criar uma instância única ("singleton") do cliente Drizzle em `src/lib/db/index.ts` era falha, criando novas conexões instáveis em cada "hot-reload" do ambiente de desenvolvimento.
- **Solução Implementada:**
    1.  **Execução Sequencial:** O script `push-db.ts` foi refatorado para garantir que o "seed" só seja executado **após** a conclusão bem-sucedida da migração, eliminando a race condition.
    2.  **Singleton Robusto:** O ficheiro `src/lib/db/index.ts` foi corrigido para garantir que uma única e mesma instância de conexão com a base de dados seja reutilizada durante o desenvolvimento, estabilizando o acesso aos dados.

### Caso #007: Erros de `batch insert` e Violação de Unicidade na Importação de CSV (Drizzle ORM)
- **Sintoma:** A importação de contatos em massa falhava com erros 500 ou 504 (Gateway Timeout). A depuração revelou dois problemas principais:
    1. Erro de sintaxe SQL do PostgreSQL: `...VALUES (default, ...), (default, ...), ...` ao tentar inserir um lote.
    2. Erros de violação de chave única (`unique constraint violation`) que interrompiam a importação inteira.
- **Causa Raiz Identificada:**
    1. **`Batch Insert` vs. `DEFAULT`:** O Drizzle ORM (na versão usada) tem um comportamento que gera SQL inválido quando tenta fazer uma inserção em lote (`batch insert`) para colunas que têm um valor padrão definidos no schema (ex: `id` com `gen_random_uuid()` ou `status` com `'ACTIVE'`).
    2. **Duplicatas no Lote:** O ficheiro CSV continha linhas com o mesmo número de telefone. O código tentava inserir todas, mas após a primeira inserção bem-sucedida, as duplicatas subsequentes causavam um erro de unicidade que abortava a transação inteira.
    3. **Performance:** A tentativa de corrigir o problema inserindo linhas uma a uma (`for...await`) dentro da transação era funcionalmente correta, mas desastrosamente lenta, causando o erro de `Gateway Timeout` em lotes grandes.
- **Solução Implementada (A Abordagem Correta):**
    1. **Manter a Inserção em Lote:** A inserção em lote (`db.insert().values([...])`) foi mantida como a única abordagem viável para performance.
    2. **Fornecer Valores Explícitos:** A causa do erro de `DEFAULT` foi resolvida na aplicação. Antes de enviar o lote para o Drizzle, o código agora **DEVE** fornecer valores explícitos para **TODAS** as colunas que têm um valor padrão no schema (ex: `createdAt: new Date()`, `status: 'ACTIVE'`). A única exceção é a chave primária `id`, que deve ser omitida para que o PostgreSQL a gere.
    3. **Pré-validação de Unicidade:** Para resolver o erro de violação de chave única, o código agora usa um `Set` em JavaScript para rastrear os telefones que já foram processados *dentro do mesmo lote*. Se uma linha duplicada for encontrada, ela é ignorada em vez de ser enviada ao banco de dados, evitando a falha da transação.

## Regra de Resposta do Assistente de IA

Para toda ação que o assistente de IA realizar, ele deve sempre incluir o seguinte cabeçalho:

**Formato:**

[TÍTULO/TEMA DA AÇÃO] AAAA-MM-DD HH:MM:SS UTC Responsável: [Nome do usuário que solicitou a ação] % de conclusão do projeto atual: [porcentagem]

**Exemplo:**

[REESTRUTURAÇÃO DO COMPONENTE DE LAYOUT] 2024-08-01 19:30:00 UTC Responsável: Diego % de conclusão do projeto atual: 100%

Esta regra deve ser seguida em todas as interações para garantir a rastreabilidade e a organização das tarefas realizadas. O responsável pela solicitação deve informar seu nome (conforme solicitado no início da sessão) para que o assistente possa preencher o campo corretamente.

**IMPORTANTE:** Antes de qualquer ação, o assistente deve seguir o protocolo de verificação e palavra-chave definido no arquivo `.project_rules.md`.

### Caso #006: Erro `ECONNRESET` no Arranque do Servidor
- **Sintoma:** O servidor de desenvolvimento falhava no arranque com um erro `Error: read ECONNRESET`. O erro ocorria durante o passo "Verificando e aplicando migrações da base de dados..." do script `dev-start.js`.
- **Causa Raiz Identificada:** Diagnóstico inicial incorreto presumiu que a base de dados era Neon DB, levando a múltiplas tentativas falhadas de correção com parâmetros de conexão específicos para o Neon (`pgbouncer`, `sslmode`). A causa real era uma configuração de base de dados para um ambiente PostgreSQL local (Docker) que não necessitava desses parâmetros.
- **Solução Implementada:** Remoção de todas as configurações de conexão específicas do Neon (`?pgbouncer=true`, `?sslmode=require`) da string de `datasource` no ficheiro `prisma/schema.prisma`. A restauração da configuração padrão para uma base de dados PostgreSQL resolveu o problema de conexão, permitindo que o `prisma migrate dev` fosse executado com sucesso no arranque.

### Caso #005: Erro de `build` - "Missing Suspense Boundary"
- **Sintoma:** Falha na compilação com o erro `useSearchParams() should be wrapped in a suspense boundary`.
- **Causa Raiz Identificada:** O hook `useSearchParams` (e outros hooks de cliente que dependem de parâmetros de URL) estava a ser usado diretamente numa página renderizada no servidor (`Server Component`), o que é proibido no App Router do Next.js.
- **Solução Implementada:** Refatoração da página afetada (`/atendimentos`). A lógica que usava os hooks foi extraída para um novo ficheiro (`atendimentos-client.tsx`) com a diretiva `'use client';`. A página original (`page.tsx`) foi simplificada para importar este novo componente e renderizá-lo dentro de uma fronteira de `<Suspense>` do React, satisfazendo os requisitos do Next.js.

### Caso #004: Erros de `build` por Tipagem em Rotas Dinâmicas (`PageProps`)
- **Sintoma:** Múltiplas falhas de compilação (`build`) com erros de tipagem, como `Type 'PageProps' does not satisfy the constraint...` e `is missing the following properties from type 'Promise<any>'`.
- **Causa Raiz Identificada:** Conflito entre os tipos de `props` (especificamente `params`) inferidos automaticamente pelo Next.js (em `.next/types`) e os tipos definidos manualmente nos ficheiros das páginas. A tentativa de criar tipos genéricos ou locais não resolveu completamente a instabilidade.
- **Solução Implementada:** Como medida de emergência para garantir a estabilidade do `build`, todas as páginas de rotas dinâmicas (ex: `[contactId]/page.tsx`) foram padronizadas para usar uma assinatura de função permissiva: `export default function Page({ params }: any)`. Esta abordagem instrui o TypeScript a não verificar os tipos das `props` da página, contornando o conflito de tipos e permitindo a compilação.

### Caso #003: Problema de Drag-and-Drop em Modal
- **Sintoma:** Ao arrastar um item dentro de um modal (diálogo), o elemento visual "escapava" dos limites do modal, aparecendo sobre o resto da página.
- **Causa Raiz Identificada:** A biblioteca `@hello-pangea/dnd` renderiza o clone do elemento arrastado no `<body>` por padrão, ignorando o contexto de empilhamento (`z-index`) e `overflow` do modal que é renderizado num portal.
- **Solução Implementada:** Modificação do componente `DialogContent` (`src/components/ui/dialog.tsx`) para detetar quando um evento de clique/arraste (`onPointerDownOutside`) é iniciado por um handle de arrastar (`data-dnd-drag-handle-context-id`) e prevenir a ação padrão do diálogo, forçando o item arrastado a respeitar o contexto do modal.

### Caso #002: Erro `auth/configuration-not-found`
- **Sintoma:** A aplicação não carregava, com um erro do Firebase na consola.
- **Causa Raiz Identificada:** O método de "Login Anônimo" estava a ser chamado no código, mas não estava ativado no painel do Firebase Console.
- **Solução Implementada:** Ativação manual do provedor de login "Anônimo" na secção Authentication > Sign-in method do Firebase Console.

### Caso #001: Erro 404 Geral na Aplicação
- **Sintoma:** A aplicação inteira parava de funcionar, exibindo um erro 404 em todas as páginas.
- **Causa Raiz Identificada:** Corrupção da estrutura de ficheiros do App Router em `/src/app`, com múltiplos ficheiros `layout.tsx` e `page.tsx` a competir no mesmo nível.
- **Solução Implementada:** Reconstrução manual da estrutura de ficheiros, garantindo um único `layout.tsx` na raiz, um `page.tsx` na raiz para a landing page, e um `layout.tsx` separado dentro do grupo `(main)` para o painel.

*(Adicione novos casos aqui conforme forem resolvidos)*
