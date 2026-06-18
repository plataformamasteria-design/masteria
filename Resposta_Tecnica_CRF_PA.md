# Resposta Técnica - Solução de Inteligência Artificial Masteria
**Ref: Solicitação de Informações Complementares – CRF-PA**

---

### 1. Descrição da Solução
A plataforma Masteria é uma solução *Omnichannel* avançada de Gestão de Relacionamento (CRM) e Atendimento automatizado por Inteligência Artificial. No contexto do atendimento institucional, a solução atua como um "Copiloto" inteligente que centraliza os canais de comunicação (ex: WhatsApp, Instagram) em uma única caixa de entrada. A Inteligência Artificial pode assumir o atendimento de forma autônoma, compreendendo as intenções do usuário e fornecendo respostas institucionais precisas, ou atuar de forma híbrida, transferindo o atendimento para um operador humano quando necessário (via sistema Kanban integrado).

### 2. Tecnologia Utilizada
A arquitetura de Inteligência Artificial da plataforma utiliza Modelos Fundacionais de Linguagem de Grande Escala (LLMs), com suporte nativo aos motores da **OpenAI (família GPT-4o e GPT-4o-mini)**, **Google Gemini** e **Anthropic**. 
Para o processamento de conhecimento específico, a Masteria emprega a tecnologia **RAG (Retrieval-Augmented Generation)**. Este mecanismo extrai, vetoriza e injeta dinamicamente o contexto institucional no *prompt* da IA, garantindo que o Processamento de Linguagem Natural (NLP) gere respostas baseadas estritamente nos dados oficiais da instituição.

### 3. Consulta e Recuperação de Informações
A solução possui um motor robusto de extração de conhecimento (`External Source Engine`) capaz de ler e processar bases documentais do CRF-PA de forma autônoma. O sistema suporta a ingestão de:
*   **Arquivos PDF:** Ideal para Resoluções, Deliberações, Legislações e Manuais.
*   **Planilhas (CSV e Google Sheets):** Excelente para estruturar FAQs e listagens de Procedimentos Internos.
*   **Páginas Web (Scraping):** Extração de textos de portais de notícias e páginas institucionais.
O algoritmo analisa os documentos, limpa os dados brutos e utiliza a própria IA para fragmentar o conteúdo em seções lógicas de conhecimento (*Prompt Sections*). Essas seções são consultadas em milissegundos sempre que um usuário faz uma pergunta, permitindo que a IA recupere a regra ou artigo exato antes de formular a resposta.

### 4. Atualização da Base de Conhecimento
**Sim.** A plataforma permite a atualização contínua da base documental pelos próprios gestores do CRF-PA, sem necessidade de intervenção técnica. Através do painel administrativo (módulo `/ia`), os usuários podem:
*   **Inclusão:** Fazer *upload* de novos PDFs ou colar links de planilhas e sites. O sistema fará a extração (*sync*) automaticamente.
*   **Alteração/Sincronização:** Solicitar a ressincronização de uma URL ou planilha que foi atualizada na origem.
*   **Exclusão:** Remover uma fonte de dados com um clique. O sistema apagará automaticamente todos os fragmentos de conhecimento atrelados àquele documento, garantindo que a IA pare de usar a informação desatualizada instantaneamente.

### 5. Integração com os Sistemas de Atendimento
A Inteligência Artificial é nativamente acoplada ao sistema de gerenciamento de atendimentos da Masteria. O fluxo ocorre da seguinte forma:
1.  **Recepção:** O cidadão envia uma mensagem via WhatsApp (conectado via *Evolution API*).
2.  **Roteamento:** A plataforma cria ou atualiza uma Sessão de Chat (*Conversation*). Se o modo IA estiver ativo (`ai_active: true`), a mensagem é enviada para o motor de Automação.
3.  **Processamento:** A IA cruza a dúvida do cidadão com o histórico da conversa e os documentos do CRF-PA (RAG).
4.  **Ação:** A IA responde diretamente ao usuário. Caso identifique que a demanda exige análise humana complexa, ela pode alterar a etapa do usuário no CRM (Kanban) e notificar a equipe, pausando a automação temporariamente.

### 6. Geração de Respostas Fundamentadas
Para garantir que não haja alucinação (respostas inventadas), o motor da Masteria adota um protocolo de contenção (System Prompt Restrito). Durante a execução, o sistema consolida as regras de negócio e os fragmentos documentais do CRF-PA em um *System Prompt* dinâmico. A IA recebe a instrução estrita de atuar apenas com as informações fornecidas no contexto, utilizando as resoluções e manuais injetados para validar sua resposta. Se a informação não constar na base documental, a IA é instruída a informar o usuário que não possui a resposta e oferecer o transbordo para um atendente humano.

### 7. Limitações da Solução
Como toda tecnologia baseada em nuvem e LLMs, a solução apresenta as seguintes características e limites operacionais:
*   **Janela de Contexto (Tokens):** O volume de documentos que a IA pode "lembrar" em uma única resposta depende do limite do modelo escolhido (ex: 128k tokens no GPT-4o). O sistema mitiga isso dividindo documentos longos, mas bibliotecas documentais gigantescas (>2.000 páginas) podem requerer indexação vetorial estrita (buscas semânticas limitadas aos top-K resultados).
*   **Limites de Rate (Provedores):** A taxa de mensagens por minuto está atrelada às cotas da API da Meta/WhatsApp e das APIs de IA (OpenAI/Google).
*   **Processamento de Mídia:** A leitura automatizada de documentos no fluxo da conversa (ex: usuário enviando uma foto de receita médica) depende das capacidades de visão computacional (Vision) ativadas na API da OpenAI e pode ter custos de processamento mais elevados.

### 8. Comprovação das Funcionalidades
Todas as funcionalidades descritas fazem parte do núcleo da plataforma Masteria. A comprovação pode ser evidenciada através de:
*   **Documentação Técnica e de Arquitetura:** Disponível para análise da equipe de TI do CRF-PA, descrevendo as rotas, os *workers* de sincronização de fontes externas (`ExternalSourceService`) e o motor de RAG e Automação (`automation-engine.ts`).
*   **Demonstração Prática (Prova de Conceito):** Nossa equipe pode realizar uma demonstração ao vivo ou fornecer acesso a um ambiente de homologação onde os avaliadores poderão realizar o upload de uma resolução do CRF-PA e fazer perguntas práticas ao agente de IA no WhatsApp para validar o nível de precisão e fluidez.
