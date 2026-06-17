"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const KNOWLEDGE_BASE = {
  institucional: {
    sobre: `O Conselho Regional de Farmácia do Estado do Pará (CRF-PA) é uma autarquia federal de regulamentação e fiscalização da profissão farmacêutica em nível estadual. Foi criado em 5 de julho de 1961 pelo CFF (Resolução nº 2), sendo o primeiro CRF implantado no país (CRF-1). Atualmente possui mais de 10.000 farmacêuticos registrados. A presidente atual é a Dra. Carolina Heitmann Mares Azevedo Ribeiro.`,
    missao: `Zelar pela profissão farmacêutica a serviço da sociedade, por meio do exercício legal do poder público federal, fiscalizando estabelecimentos e orientando e qualificando profissionais farmacêuticos.`,
    atribuicoes: `• Registrar profissionais e expedir a carteira profissional\n• Examinar reclamações e representações escritas sobre infrações\n• Fiscalizar o exercício da profissão, impedindo e punindo infrações\n• Organizar seu Regimento Interno, submetendo-o ao CFF`,
  },
  contatos: {
    sede: {
      nome: "Sede CRF/PA",
      endereco: "Avenida José Bonifácio, N° 295, Bairro Fátima, CEP 66090-363, Belém/PA",
      referencia: "Antigo prédio da SINCOR/PA",
      telefone: "(91) 3239-9500",
      email: "crfpa@crfpa.org.br",
      horario: "9h às 16h",
    },
    seccionais: [
      { nome: "Seccional Oeste", local: "Santarém/PA", endereco: "Av. Álvaro Adolfo, nº 233, Bairro Prainha, CEP 68.005-150", telefone: "(93) 9 9141-0995", email: "oeste@crfpa.org.br", horario: "9h às 16h" },
      { nome: "Seccional Sudeste", local: "Marabá/PA", endereco: "FL: CSI.31 QD.07 LT.10, Nova Marabá, CEP 68507-590", telefone: "(94) 99119-8507", email: "sudeste@crfpa.org.br", horario: "9h às 16h" },
      { nome: "Seccional Nordeste", local: "Castanhal/PA", endereco: "Av. Barão do Rio Branco, 1275 – Sala 102, Edifício Diamond Center, Saudade I, CEP 68742-090", telefone: "(91) 3711-0504", email: "nordeste@crfpa.org.br", horario: "9h às 16h" },
      { nome: "Seccional Sul", local: "Redenção/PA", endereco: "Rua Ildonete Guimarães, 33, Qdr 68, Lt 19, Jardim Umuarama, CEP 68552-185", telefone: "(94) 99203-9697 | (94) 3424-6133", email: "sul@crfpa.org.br", horario: "9h às 16h" },
    ],
  },
  inscricoes: {
    provisoria: {
      titulo: "Inscrição Provisória",
      descricao: "Exclusiva para farmacêutico(a) que colou grau e ainda não possui o diploma.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "Declaração de Ciência de custos (alteração provisória → definitiva)",
        "Atestado de boa reputação assinado por 3 farmacêuticos inscritos",
        "2 fotos coloridas 3×4 (fundo branco, roupa escura)",
        "RG com validade de 10 anos (não aceito CNH)",
        "CPF",
        "Título de eleitor ou Certidão de Quitação Eleitoral",
        "Reservista (masculino)",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Histórico Escolar do curso de Farmácia",
        "Declaração ou Certidão da IES comprovando conclusão e colação de grau",
        "Recolhimento dos custos específicos",
      ],
      obs: "Para envio pelos Correios, documentos pessoais devem ser autenticados em cartório.",
    },
    definitiva: {
      titulo: "Inscrição Definitiva",
      descricao: "Exclusiva para farmacêutico(a) que colou grau e possui o diploma.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "Atestado de boa reputação assinado por 3 farmacêuticos inscritos",
        "3 fotos coloridas 3×4 (fundo branco, roupa escura)",
        "RG com validade de 10 anos (não aceito CNH)",
        "CPF",
        "Título de eleitor ou Certidão de Quitação Eleitoral",
        "Reservista (masculino)",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Histórico Escolar do curso de Farmácia",
        "Diploma do curso (original e cópia)",
        "Recolhimento dos custos específicos",
      ],
    },
    transferencia: {
      titulo: "Inscrição por Transferência (de outro CRF para o CRF-PA)",
      descricao: "Para farmacêutico(a) que solicitou transferência de outro CRF para o Pará.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "2 fotos coloridas 3×4 (fundo branco, roupa escura)",
        "RG com validade de 10 anos (não aceito CNH)",
        "CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Certidão de transferência fornecida pelo CRF de origem",
        "Se Provisória: Declaração da IES de conclusão e colação de grau",
        "Se Definitiva: Diploma + Carteira Profissional marrom para visto do Presidente",
        "Recolhimento dos custos específicos",
      ],
    },
    secundaria: {
      titulo: "Inscrição Secundária (no CRF-PA)",
      descricao: "Para farmacêutico(a) com inscrição ativa em outro Regional que deseja exercer no Pará.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "1 foto colorida 3×4 (fundo branco, roupa escura)",
        "RG com validade de 10 anos, CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Certidão do CRF de origem confirmando situação regular",
        "Diploma (se definitiva) ou Declaração de conclusão (se provisória)",
        "Carteira Profissional marrom (se definitiva) para visto do Presidente",
        "ATENÇÃO: Todas as despesas são por conta do profissional",
      ],
    },
    remida: {
      titulo: "Inscrição Remida",
      descricao: "Para farmacêutico(a) dispensado do pagamento de anuidades.",
      requisitos: [
        "Idade mínima de 65 anos",
        "Contribuição mínima de 30 anos junto ao CRF-PA",
        "Estar quite junto ao CRF-PA",
        "Não estar suspenso nem respondendo processo ético-disciplinar",
      ],
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "1 foto colorida 3×4",
        "RG, CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Diploma do curso de Farmácia",
        "Carteira Profissional marrom",
        "Nota: Portadores de doenças incapacitantes também podem ser considerados remidos mediante laudo médico",
      ],
    },
    vistoTemporario: {
      titulo: "Inscrição por Visto Temporário (no CRF-PA)",
      descricao: "Para farmacêutico(a) de outro Regional que exercerá no Pará por até 90 dias.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "1 foto colorida 3×4",
        "RG, CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Certidão do CRF de origem (situação regular, atividade atual, endereço da empresa)",
        "GRATUITO — Não há taxas de pagamento",
      ],
    },
    estrangeiros: {
      titulo: "Inscrição de Estrangeiros / Diploma Expedido no Exterior",
      descricao: "Exclusiva para farmacêutico(a) formado no exterior.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "3 fotos coloridas 3×4",
        "RG, Passaporte com visto permanente (autenticados)",
        "CPF, Título de eleitor, Reservista",
        "Cópia de tipagem sanguínea, Comprovante de residência do Pará",
        "Diploma registrado pela IES estrangeira com visto consular brasileiro",
        "Comprovante de diploma revalidado por universidade pública brasileira",
        "Refugiados: apresentar CRNM (Carteira de Registro Nacional Migratório)",
        "Documentos em língua estrangeira devem ter tradução juramentada",
        "NÃO é permitida inscrição provisória para estrangeiros",
      ],
    },
    reativada: {
      titulo: "Inscrição Reativada",
      descricao: "Para farmacêutico(a) que cancelou a inscrição e deseja reativar.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "Atestado de boa reputação assinado por 3 farmacêuticos inscritos",
        "2 fotos coloridas 3×4",
        "RG, CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Histórico Escolar e Diploma do curso de Farmácia",
        "ATENÇÃO: Todas as despesas de reativação são por conta do profissional",
      ],
    },
    tecnico: {
      titulo: "Inscrição Técnico de Laboratório",
      descricao: "Exclusiva para técnico de laboratório em análises clínicas, patologia ou biodiagnóstico.",
      documentos: [
        "Requerimento de Inscrição de Pessoa Física do CRF/PA",
        "3 fotos coloridas 3×4",
        "RG, CPF, Título de eleitor, Reservista",
        "Certidão de casamento/divórcio (se casado)",
        "Cópia de tipagem sanguínea",
        "Comprovante de residência do Pará",
        "Diploma ou Certificado de Ensino Médio",
        "Histórico Escolar do Curso Técnico",
        "Diploma do Curso Técnico reconhecido pelo MEC-SisTec",
        "Recolhimento dos custos específicos",
      ],
    },
  },
  procedimentos: {
    baixaRT: {
      titulo: "Baixa de Responsabilidade Técnica",
      descricao: "Para farmacêutico(a) que deixou de exercer a responsabilidade técnica em uma empresa.",
      info: [
        "A baixa DEVE ser comunicada ao CRF em até 5 dias úteis após a saída da empresa",
        "Pode ser feita presencialmente ou pelo CRF em Casa",
        "Somente o próprio farmacêutico pode protocolar sua baixa de RT",
        "GRATUITO",
        "Como fazer pelo CRF em Casa: Acesse como Pessoa Física → Serviços → Baixa de Contrato de Trabalho",
        "Documentos: Requerimento de Baixa CRF/PA",
      ],
    },
    cancelamentoInscricao: {
      titulo: "Cancelamento de Inscrição",
      descricao: "Para farmacêutico(a) ou técnico que não exercerá mais sua atividade profissional.",
      info: [
        "Falecimento: enviar cópia da certidão de óbito para secretariafarmaceutico@crfpa.org.br",
        "Farmacêutico: Requerimento de Cancelamento + Carteira marrom + Cédula profissional",
        "Técnico: Requerimento Diversos do CRF/PA",
        "Em caso de extravio da carteira/cédula: apresentar Boletim de Ocorrência",
        "Se solicitado até 15 de janeiro: não há cobrança da anuidade vigente",
        "Após 15/01: cobrança proporcional ao mês da solicitação",
        "IMPORTANTE: Débitos não são excluídos após o cancelamento",
        "Se ainda vinculado a empresa: solicitar baixa de RT antes do cancelamento",
      ],
    },
    transferenciaSaida: {
      titulo: "Transferência para Outro Regional",
      descricao: "Para farmacêutico(a) que exercerá a profissão em outro Estado.",
      requisitos: [
        "Não possuir responsabilidade técnica ativa",
        "Pagamento da anuidade integral no ano da solicitação",
      ],
      info: [
        "Documentos: Requerimento Diversos + Carteira Profissional marrom",
        "A certidão é enviada por e-mail ao CRF de destino com cópia ao profissional",
        "Certidão expedida em até 30 dias com validade de 60 dias",
        "Se não ativada no CRF de destino: documentos devolvidos e inscrição reativada no CRF-PA",
      ],
    },
    vistoSaida: {
      titulo: "Visto Temporário em Outro Regional",
      descricao: "Para farmacêutico(a) que exercerá provisoriamente por até 90 dias em outro Regional.",
      info: [
        "Documentos: Requerimento Diversos do CRF/PA",
        "Certidão enviada por e-mail ao CRF de destino com cópia ao profissional",
        "Certidão expedida em até 30 dias com validade de 60 dias",
      ],
    },
    secundariaSaida: {
      titulo: "Inscrição Secundária em Outro Regional",
      descricao: "Para farmacêutico(a) que exercerá a profissão em dois Regionais.",
      info: [
        "Documentos: Requerimento Diversos do CRF/PA",
        "Certidão enviada por e-mail ao CRF de destino com cópia ao profissional",
        "Certidão expedida em até 30 dias com validade de 60 dias",
        "Todas as despesas são por conta do profissional solicitante",
      ],
    },
    segundaVia: {
      titulo: "2ª Via da Carteira e/ou Cédula Profissional",
      descricao: "Para farmacêutico(a)/técnico que não possui a via original.",
      info: [
        "Documentos: Requerimento Diversos + 1 foto 3×4",
        "Em caso de extravio, furto ou roubo: apresentar cópia do Boletim de Ocorrência",
        "Em caso de dano: devolver a carteira original junto com a solicitação",
        "Recolhimento dos custos por cada documento",
      ],
    },
    averbacaoTitulos: {
      titulo: "Averbação de Títulos",
      descricao: "Para farmacêutico(a) com especializações, residências, mestrado ou doutorado.",
      info: [
        "Documentos: Requerimento Diversos + Formulário de Averbação + Carteira marrom + Diploma/certificado (frente e verso) + Histórico acadêmico",
        "Cursos lato sensu devem seguir critérios e referenciais mínimos do CFF",
        "Diplomas de mestrado/doutorado obtidos no exterior exigem revalidação em IES pública nacional",
        "Cursos sem linhas regulamentadas serão analisados pela Comensino/CFF",
      ],
    },
    averbacaoCursosLivres: {
      titulo: "Averbação de Cursos Livres",
      descricao: "Para farmacêutico(a) com qualificações específicas relacionadas às áreas de atuação.",
      info: [
        "Documentos: Requerimento Diversos + Carteira marrom + Diploma/certificado (frente e verso)",
        "Conforme Código de Ética (Res. CFF 724/22): é proibido declarar títulos que não possa comprovar",
        "Cursos não contemplados em linhas regulamentadas serão analisados pela Comensino/CFF",
      ],
    },
    alteracoesCadastrais: {
      titulo: "Alterações Cadastrais",
      descricao: "Para farmacêutico(a) que precisa alterar nome ou estado civil.",
      info: [
        "Documentos: Requerimento Diversos + Carteira marrom + RG + Certidão de casamento/divórcio",
        "Para nova carteira/cédula com nome alterado: seguir procedimento de 2ª via",
        "Para inclusão de nome social: requerimento conforme Decreto nº 8.727/2016",
      ],
    },
    telefarmacia: {
      titulo: "Serviço de Telefarmácia",
      descricao: "Para farmacêutico(a) atuando em Farmácia Clínica de forma remota (Res. CFF 727/22).",
      info: [
        "ATENÇÃO: É VEDADO ao farmacêutico assumir responsabilidade técnica por farmácia, laboratório, indústria etc. de forma NÃO PRESENCIAL",
        "A telefarmácia é permitida exclusivamente para serviços clínicos (atendimento, comunicação, prescrição e monitoramento de paciente)",
        "Documentos: Requerimento Diversos + Declaração de Telefarmácia + Comprovante de Inscrição (CISC)",
        "O farmacêutico deve dispor de todos os equipamentos e plataformas necessários",
        "Basta ter inscrição no CRF de sua jurisdição para atuar por Telefarmácia",
      ],
    },
    comunicadoAusencia: {
      titulo: "Comunicado de Ausência",
      descricao: "Comunicação de afastamento temporário das atividades com responsabilidade técnica.",
      info: [
        "Formulário disponível no CRF em Casa (COMUNICADO DE AUSÊNCIA)",
        "Antecedência mínima de 12 horas (férias, congressos, cursos) — Res. CFF 724/22",
        "Afastamento por doença/acidente/licença maternidade/óbito familiar: comunicar em até 5 dias úteis com documentos comprobatórios",
        "IMPORTANTE: O comunicado NÃO impede a fiscalização do CRF/PA",
        "IMPORTANTE: O comunicado NÃO isenta a empresa das consequências legais",
        "Esse direito é EXCLUSIVO do profissional (Pessoa Física), não da empresa",
      ],
    },
    isencaoMilitar: {
      titulo: "Isenção de Anuidade — Militar na Ativa",
      descricao: "Para farmacêutico(a) em serviço ativo exclusivo nas Forças Armadas.",
      info: [
        "Previsto na Resolução CFF nº 14/24",
        "Documentos: Requerimento Diversos + Carteira marrom + Declaração assinada pela autoridade competente",
        "A isenção deve ser requerida ANUALMENTE conforme Lei Federal nº 6.681/79",
      ],
    },
    aapf: {
      titulo: "Certidão de Anotação de Atividade de Profissional Farmacêutica (AAPF)",
      descricao: "Documento comprobatório de qualificação profissional para determinadas atividades.",
      info: [
        "A AAPF NÃO substitui a Certidão de Regularidade (CR) e NÃO concede responsabilidade técnica formal",
        "Aplica-se quando: necessitar demonstrar aptidão para elaborar/responder por plano ou projeto (ex.: Plano de Gerenciamento); atuar em estabelecimentos dispensados de registro no CRF; comprovar habilitação para atividades específicas",
        "Documentos: Requerimento de AAPF + Documento comprobatório da empresa (contrato social/estatuto) + Carteira de trabalho ou Contrato de prestação de serviço",
      ],
    },
    renMigracaoProvisDefinitiva: {
      titulo: "Migração de Inscrição Provisória para Definitiva",
      descricao: "Para farmacêutico(a) com inscrição provisória que agora possui o diploma.",
      info: [
        "Documentos: Requerimento Diversos + Atestado de boa reputação (3 farmacêuticos) + Cédula Provisória + 2 fotos 3×4 + Diploma (cópia e original) + Recolhimento dos custos",
      ],
    },
    renovacaoProvisoria: {
      titulo: "Renovação de Inscrição Provisória",
      descricao: "Para farmacêutico(a) com inscrição provisória que ainda não possui o diploma. Renova por mais 12 meses.",
      info: [
        "Documentos: Requerimento Diversos + Atestado de boa reputação (3 farmacêuticos) + Cédula Provisória + 1 foto 3×4 + Declaração atualizada da IES informando que o diploma ainda está sendo confeccionado + Recolhimento dos custos",
      ],
    },
  },
  anuidades: {
    info: `A cobrança das anuidades é feita de acordo com o valor do capital social das empresas (pessoa jurídica). Para pessoa física, seguem as tabelas definidas pelo CFF com base nas Leis Federais nº 11.000/2004 e nº 12.514/2011. Os valores são reajustados anualmente pelo INPC/IBGE. Os boletos de anuidade 2026 foram liberados — acesse o CRF em Casa para emitir o seu.`,
    cancelamento: `Se a solicitação de cancelamento de inscrição for feita até 15 de janeiro: não há cobrança da anuidade vigente. Após essa data: cobrança proporcional ao mês da solicitação.`,
  },
  crfEmCasa: {
    info: `O CRF em Casa é o sistema online do CRF-PA para acesso a serviços remotos.\n\nAcesse em: https://crfpa-emcasa.cisantec.com.br/crf-em-casa/login.jsf\n\nServiços disponíveis pelo CRF em Casa:\n• Comunicado de Ausência\n• Baixa de Responsabilidade Técnica\n• Acompanhamento de Protocolo`,
  },
  faq: [
    { pergunta: "Como cancelar o registro de uma empresa?", resposta: "Enviar o formulário de cancelamento de inscrição preenchido e assinado pelo proprietário ou representante legal, sem pendências financeiras. Se for representante legal, apresentar procuração registrada em cartório. Se o responsável técnico ainda estiver vinculado, solicitar a baixa antes." },
    { pergunta: "Como é feita a cobrança de anuidades das empresas?", resposta: "A cobrança é feita de acordo com o valor do capital social das empresas, conforme as Leis Federais nº 11.000/2004 e nº 12.514/2011, com reajuste anual pelo INPC/IBGE." },
    { pergunta: "Qual o procedimento para baixa de responsabilidade técnica?", resposta: "O procedimento é gratuito e pode ser feito presencialmente ou pelo CRF em Casa. Apresentar o Requerimento de Baixa preenchido. No CRF em Casa: Pessoa Física → Serviços → Baixa de Contrato de Trabalho." },
    { pergunta: "Quais são os critérios para habilitação em oncologia?", resposta: "Consulte a padronização de conduta dos CRFs disponível no site do CRF-PA (crfpara.org.br/faq)." },
  ],
};

const SYSTEM_PROMPT = `Você é o assistente virtual oficial do CRF-PA (Conselho Regional de Farmácia do Estado do Pará).

Seu papel é atender farmacêuticos, técnicos de laboratório e cidadãos com informações precisas sobre serviços, procedimentos e documentações do Conselho.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS DE COMPORTAMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Responda SEMPRE em português brasileiro, de forma clara e objetiva.
2. Use EXCLUSIVAMENTE as informações da base de conhecimento fornecida no contexto.
3. Nunca invente documentos, prazos, valores ou procedimentos.
4. Se não tiver a informação, oriente: "Entre em contato pelo (91) 3239-9500 ou crfpa@crfpa.org.br".
5. Para valores exatos de anuidades e taxas, sempre oriente a contatar o CRF diretamente.
6. Ao listar documentos ou requisitos, use listas numeradas ou com bullet points (•).
7. Sempre informe quando o serviço é GRATUITO ou tem custo (recolhimento de custos específicos).
8. Ao mencionar o CRF em Casa, informe o link: https://crfpa-emcasa.cisantec.com.br/crf-em-casa/login.jsf
9. Mantenha um tom profissional, cordial e prestativo.
10. Ao finalizar uma resposta sobre procedimento, pergunte se o usuário precisa de mais alguma informação.
11. Identifique se é farmacêutico, técnico ou cidadão para direcionar melhor o atendimento.
12. Não responda perguntas fora do escopo do CRF-PA (ex: prescrições médicas, dúvidas clínicas).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DAS RESPOSTAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Para procedimentos: título em negrito + documentos em lista numerada + orientações gerais
- Para contatos: nome da unidade, endereço, telefone, e-mail e horário em sequência
- Para dúvidas simples: resposta direta em 1-3 parágrafos
- Máximo de 400 tokens por resposta (seja completo mas conciso)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BASE DE CONHECIMENTO (CONTEXTO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(KNOWLEDGE_BASE, null, 2)}`;

const QUICK_REPLIES = [
  { label: "📋 Inscrição Provisória", text: "Quais documentos preciso para fazer inscrição provisória?" },
  { label: "📋 Inscrição Definitiva", text: "Como faço minha inscrição definitiva?" },
  { label: "🔄 Baixa de RT", text: "Como fazer a baixa de responsabilidade técnica?" },
  { label: "🏢 Contatos e Endereços", text: "Quais são os endereços e telefones do CRF-PA?" },
  { label: "🔁 Transferência", text: "Como transferir minha inscrição para outro estado?" },
  { label: "💻 CRF em Casa", text: "O que é o CRF em Casa e como acessar?" },
  { label: "📅 Comunicado de Ausência", text: "Como registrar um comunicado de ausência?" },
  { label: "📜 Cancelamento de Inscrição", text: "Como cancelar minha inscrição no CRF-PA?" },
];

export default function CRFPAChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá! Sou o assistente virtual do **CRF-PA**. Estou aqui para ajudar farmacêuticos e técnicos com informações sobre inscrições, procedimentos e serviços do Conselho Regional de Farmácia do Estado do Pará.\n\nComo posso te ajudar hoje?",
      timestamp: new Date()
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg = { role: "user", content: userText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const newHistory = [...conversationHistory, { role: "user", content: userText }];

    try {
      const response = await fetch("/api/crfpa-chat", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
          system: SYSTEM_PROMPT,
          messages: newHistory,
        }),
      });

      const data = await response.json();
      const assistantText = data.text || "Desculpe, ocorreu um erro. Tente novamente.";

      const assistantMsg = { role: "assistant", content: assistantText, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
      setConversationHistory([...newHistory, { role: "assistant", content: assistantText }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão. Por favor, tente novamente ou entre em contato pelo (91) 3239-9500.", timestamp: new Date() }]);
    }
    setLoading(false);
  };

  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n• /g, "<br/>• ")
      .replace(/\n\d+\. /g, (m) => "<br/>" + m.trim() + " ")
      .replace(/\n/g, "<br/>");
  };

  return (
    <div className="flex w-full h-[100dvh] sm:items-center sm:justify-center bg-zinc-100 dark:bg-zinc-950 sm:p-4 overflow-hidden relative">
      {/* iPhone Frame */}
      <div className={cn(
        "flex flex-col bg-zinc-50 dark:bg-[#09090b] relative overflow-hidden w-full h-full",
        "sm:max-w-[400px] sm:h-[85vh] sm:border-[4px] sm:border-zinc-800 sm:rounded-[2.5rem] sm:shadow-2xl sm:ring-1 sm:ring-zinc-950"
      )}>
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-6 justify-center z-20 pointer-events-none hidden sm:flex">
          <div className="w-[120px] h-[22px] bg-zinc-800 rounded-b-xl" />
        </div>

        {/* Header */}
        <div className="shrink-0 bg-primary pb-3 px-4 flex items-center gap-3 shadow-sm z-10 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-8">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10 pointer-events-none">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0 select-none">
            <p className="text-[15px] font-semibold text-white leading-tight truncate">
              CRF-PA Virtual
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#69f0ae] animate-pulse" />
              <p className="text-[11px] text-white/80 truncate">online simulando</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 bg-zinc-50 dark:bg-[#09090b]">
          <div className="p-4 space-y-2.5 min-h-full pb-8">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn("flex my-1 px-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "px-4 py-2.5 max-w-[85%] shadow-sm relative pb-6",
                  msg.role === "user" 
                    ? "bg-primary rounded-[1.25rem] rounded-tr-[4px]" 
                    : "bg-white dark:bg-zinc-900 rounded-[1.25rem] rounded-tl-[4px] border border-neutral-100 dark:border-zinc-800"
                )}>
                  <p 
                    className={cn("text-[13px] whitespace-pre-wrap leading-[1.3] font-normal w-full overflow-hidden", msg.role === "user" ? "text-white" : "text-zinc-800 dark:text-zinc-200")}
                    dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
                  />
                  <div className="absolute bottom-1 right-2 flex items-center justify-end gap-1">
                    <span className={cn("text-[10px] font-medium", msg.role === "user" ? "text-white/70" : "text-neutral-400 dark:text-zinc-500")}>
                      {msg.timestamp?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "agora"}
                    </span>
                    {msg.role === "user" && <CheckCheck className="h-3.5 w-3.5 text-white/50 ml-0.5" />}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start my-1 px-2">
                <div className="bg-white dark:bg-zinc-900 rounded-[1.25rem] rounded-tl-sm px-4 py-2.5 shadow-sm border border-neutral-100 dark:border-zinc-800 w-fit">
                  <div className="flex gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:0ms]" />
                    <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:150ms]" />
                    <div className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-zinc-600 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Replies */}
        <div className="w-full bg-white dark:bg-zinc-950 border-t border-neutral-200 dark:border-zinc-800 p-2 overflow-x-auto whitespace-nowrap flex gap-2 no-scrollbar scroll-smooth">
          {QUICK_REPLIES.map((qr, i) => (
            <button 
              key={i} 
              onClick={() => sendMessage(qr.text)} 
              className="flex-shrink-0 px-3 py-1.5 rounded-full border border-primary/30 bg-white dark:bg-zinc-900 text-primary dark:text-primary-foreground text-[11px] font-medium cursor-pointer transition-all hover:bg-primary hover:text-white"
            >
              {qr.label}
            </button>
          ))}
        </div>

        {/* Footer Input */}
        <div className={cn(
          "shrink-0 bg-white dark:bg-zinc-950 relative z-10 border-t border-neutral-200 dark:border-zinc-800",
          "px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:pb-2"
        )}>
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }} 
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida sobre o CRF-PA..."
              className="flex-1 h-10 text-[13px] bg-neutral-50 dark:bg-zinc-900 border-neutral-200 dark:border-zinc-800 text-neutral-800 dark:text-zinc-200 placeholder:text-neutral-400 dark:placeholder:text-zinc-500 rounded-full px-4 shadow-sm focus-visible:ring-0 focus-visible:border-primary"
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 shadow-sm text-white shrink-0" 
              disabled={!input.trim() || loading}
            >
              <Send className="h-4 w-4 -ml-0.5" />
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
}
