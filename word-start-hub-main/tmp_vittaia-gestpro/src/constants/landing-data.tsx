import {
    MessageSquare, BarChart3, Zap, Brain, Calendar, DollarSign,
    Users, Send, Kanban, Bot, Target, Tag, Palette, FileText, Layout
} from "lucide-react";
import heroRobotBg from "@/assets/hero-robot-bg.jpg";
import heroAtendimentoBg from "@/assets/hero-atendimento-bg.jpg";
import testimonialMaria from "@/assets/testimonial-maria.jpg";
import testimonialCarlos from "@/assets/testimonial-carlos.jpg";
import testimonialAna from "@/assets/testimonial-ana.jpg";
import testimonialJuliana from "@/assets/testimonial-juliana.jpg";
import testimonialRoberto from "@/assets/testimonial-roberto.jpg";
import testimonialFernanda from "@/assets/testimonial-fernanda.jpg";
import testimonialLucas from "@/assets/testimonial-lucas.jpg";
import testimonialPatricia from "@/assets/testimonial-patricia.jpg";
import dashboardPreview from "@/assets/screenshots/dashboard.png";
import chatPreview from "@/assets/screenshots/chat.png";
import agendaPreview from "@/assets/screenshots/agenda.png";
import comandosPreview from "@/assets/screenshots/comandos.png";
import relatoriosPreview from "@/assets/screenshots/relatorios.png";
import crmPreview from "@/assets/screenshots/crm.png";
import automacaoPreview from "@/assets/screenshots/automacao.png";
import disparosPreview from "@/assets/screenshots/disparos.png";
import financeiroPreview from "@/assets/screenshots/financeiro.png";
import equipesPreview from "@/assets/screenshots/equipes.png";
import coresPreview from "@/assets/screenshots/cores.png";

export const FEATURE_SECTIONS = [
    {
        icon: <Bot className="h-5 w-5" />,
        image: automacaoPreview,
        emoji: "🤖",
        title: "Automações Poderosas",
        subtitle: "Simples ou Avançadas",
        description: "Automatize do básico ao avançado.",
        bullets: [
            "Mensagens automáticas pré-definidas",
            "Automações com Inteligência Artificial",
            "Fluxos visuais fáceis de configurar",
            "Integração via HTTP Request com plataformas externas",
        ],
        footer: "Tudo com a facilidade do ManyChat e o poder de automação do n8n em uma única plataforma.",
    },
    {
        icon: <MessageSquare className="h-5 w-5" />,
        image: chatPreview,
        emoji: "💬",
        title: "Chat Omnichannel Organizado por Agente",
        subtitle: "",
        description: "Centralize suas conversas em uma única aba.",
        bullets: [
            "WhatsApp, Facebook e Instagram integrados",
            "Conversas organizadas por agente, equipe ou status",
            "Histórico completo do cliente",
            "Mais controle, menos confusão",
        ],
        footer: "Seu atendimento profissional, organizado e escalável.",
    },
    {
        icon: <Kanban className="h-5 w-5" />,
        image: crmPreview,
        emoji: "🧩",
        title: "CRM Kanban Avançado",
        subtitle: "Crie Quantos Funis Quiser",
        description: "Visual, flexível e poderoso.",
        bullets: [
            "CRM estilo Kanban, similar ao Kommo",
            "Criação de múltiplos funis",
            "Processos personalizados por negócio",
            "Controle total do pipeline de vendas",
        ],
        footer: "Venda com previsibilidade.",
    },
    {
        icon: <BarChart3 className="h-5 w-5" />,
        image: dashboardPreview,
        emoji: "📊",
        title: "Dashboard com Métricas Inteligentes",
        subtitle: "Decida com Dados",
        description: "Visualize tudo que importa em tempo real.",
        bullets: [
            "Performance de atendimento e vendas",
            "Leads, funis, conversões e produtividade",
            "Resultados por canal, agente ou período",
            "Indicadores inteligentes para decisões rápidas",
        ],
        footer: "Tudo em um dashboard limpo, personalizável e fácil de entender.",
    },
    {
        icon: <Send className="h-5 w-5" />,
        image: disparosPreview,
        emoji: "📣",
        title: "Disparos em Massa Inteligentes",
        subtitle: "",
        description: "Escala com controle.",
        bullets: [
            "Envio de mensagens para listas ou base de leads",
            "Segmentação inteligente",
            "Comunicação em massa sem perder personalização",
        ],
        footer: "Perfeito para campanhas, avisos e follow-ups.",
    },
    {
        icon: <Calendar className="h-5 w-5" />,
        image: agendaPreview,
        emoji: "📅",
        title: "Agenda Inteligente com Multiagendas",
        subtitle: "",
        description: "Transforme agendamento em conversão.",
        bullets: [
            "Múltiplas agendas por usuário ou equipe",
            "Links inteligentes de agendamento",
            "Integração com sites e funis",
            "Distribuição automática de atendimentos",
        ],
        footer: "Chega de conflito de horários ou perda de oportunidades.",
    },
    {
        icon: <Palette className="h-5 w-5" />,
        image: coresPreview,
        emoji: "🎨",
        title: "Plataforma 100% Personalizável",
        subtitle: "",
        description: "Sua marca, do seu jeito.",
        bullets: [
            "Cores, identidade visual e fluxos",
            "Plataforma adaptada ao seu modelo de negócio",
            "Cresce junto com sua operação",
        ],
        footer: "",
    },
    {
        icon: <FileText className="h-5 w-5" />,
        image: relatoriosPreview,
        emoji: "📈",
        title: "Relatórios e Análises Independentes",
        subtitle: "",
        description: "Crie análises do seu jeito.",
        bullets: [
            "Relatórios personalizados",
            "Análises independentes por funil, equipe ou período",
            "Dados claros para decisões estratégicas",
        ],
        footer: "Você no controle da informação.",
    },
    {
        icon: <DollarSign className="h-5 w-5" />,
        image: financeiroPreview,
        emoji: "💰",
        title: "Financeiro Completo Integrado",
        subtitle: "",
        description: "Tenha controle real do dinheiro.",
        bullets: [
            "Entradas, saídas e recorrências",
            "Relatórios financeiros claros",
            "Visão integrada com vendas e clientes",
        ],
        footer: "Gestão financeira sem planilhas confusas.",
    },
    {
        icon: <Zap className="h-5 w-5" />,
        image: comandosPreview,
        emoji: "⚡",
        title: "Comandos Rápidos com Sequências Personalizáveis",
        subtitle: "",
        description: "Ganhe velocidade no atendimento.",
        bullets: [
            "Respostas prontas e personalizadas",
            "Sequências automáticas de mensagens",
            "Padronização sem perder o toque humano",
        ],
        footer: "Menos digitação. Mais eficiência.",
    },
    {
        icon: <Users className="h-5 w-5" />,
        image: equipesPreview,
        emoji: "👥",
        title: "Gestão de Equipes e Usuários",
        subtitle: "",
        description: "Organize sua operação com facilidade.",
        bullets: [
            "Permissões por usuário",
            "Controle de produtividade",
            "Gestão de equipes em um só lugar",
            "Até 10 usuários gratuitos no plano base",
        ],
        footer: "",
    },
];

export const MODULES_CAROUSEL = [
    { icon: <Layout className="h-6 w-6" />, name: "Dashboard", description: "Métricas e análises em tempo real do seu negócio com gráficos inteligentes e indicadores de performance." },
    { icon: <MessageSquare className="h-6 w-6" />, name: "Chat", description: "Atendimento centralizado com WhatsApp, Facebook e Instagram. Organize por agente, equipe ou status." },
    { icon: <Calendar className="h-6 w-6" />, name: "Agenda", description: "Calendários múltiplos, links de agendamento, widget público e distribuição automática de atendimentos." },
    { icon: <Zap className="h-6 w-6" />, name: "Comandos", description: "Respostas rápidas e sequências personalizáveis para ganhar velocidade no atendimento." },
    { icon: <Target className="h-6 w-6" />, name: "Leads", description: "Organize, qualifique e acompanhe seus contatos com controle total do ciclo de vendas." },
    { icon: <Tag className="h-6 w-6" />, name: "Relatórios e Etiquetas", description: "Relatórios personalizados e etiquetas para segmentação inteligente dos seus contatos." },
    { icon: <Kanban className="h-6 w-6" />, name: "CRM", description: "Pipeline visual Kanban com múltiplos funis, drag & drop e controle total das vendas." },
    { icon: <Users className="h-6 w-6" />, name: "Equipe", description: "Gerencie permissões, produtividade e equipes em um só lugar. Até 10 usuários gratuitos." },
    { icon: <DollarSign className="h-6 w-6" />, name: "Financeiro", description: "Controle completo de entradas, saídas, recorrências e relatórios financeiros." },
    { icon: <Bot className="h-6 w-6" />, name: "Automações", description: "Fluxos visuais com IA, triggers, condições e ações avançadas. Do básico ao sofisticado." },
    { icon: <Send className="h-6 w-6" />, name: "Disparos", description: "Campanhas em massa com segmentação inteligente para listas ou base completa de leads." },
    { icon: <Brain className="h-6 w-6" />, name: "Agentes de IA", description: "Atendente de IA 24h com automação inteligente e configuração completa pelo desenvolvedor." },
];

export const NAV_LINKS = [
    { name: "Funcionalidades", href: "#funcionalidades" },
    { name: "Diferenciais", href: "#diferenciais" },
    { name: "Planos", href: "#planos" },
    { name: "FAQ", href: "#faq" },
];

export const MODULE_PLANS = [
    {
        name: "Módulo Padrão",
        modulePrice: "R$ 297",
        comboPrice: "R$ 297",
        period: "/mês",
        tag: "Obrigatório",
        popular: false,
        required: true,
        items: ["Dashboard", "Chat", "Agenda (sem link e widget)", "Comandos", "Leads (sem robô)", "Relatórios e Etiquetas", "CRM", "Equipe", "Financeiro", "Mensagens automáticas", "Conexão WhatsApp inclusa"],
    },
    {
        name: "Padrão + Automação",
        modulePrice: "R$ 197",
        comboPrice: "R$ 494",
        period: "/mês",
        tag: "Mais contratado",
        popular: true,
        required: false,
        items: ["Dashboard", "Chat", "Agenda completa com link e widget", "Comandos", "Leads", "Relatórios e Etiquetas", "CRM", "Equipe", "Financeiro", "Mensagens automáticas", "Conexão WhatsApp inclusa", "Automação por fluxo", "Disparos em massa"],
        savings: "Economize contratando juntos",
    },
    {
        name: "Completo com IA",
        modulePrice: "R$ 497",
        comboPrice: "R$ 991",
        period: "/mês",
        tag: "Tudo incluso",
        popular: false,
        required: false,
        items: ["Dashboard", "Chat", "Agenda completa com link e widget", "Comandos", "Leads", "Relatórios e Etiquetas", "CRM", "Equipe", "Financeiro", "Mensagens automáticas", "Conexão WhatsApp inclusa", "Automação por fluxo", "Disparos em massa", "Atendente de I.A", "Automação inteligente", "Aba Desenvolvedor"],
        notes: ["Tokens de IA contratados à parte", "Recarregáveis sob demanda"],
    },
];

export const TESTIMONIALS = [
    { name: "Maria S.", role: "Gestora de Clínica", text: "A Vitta revolucionou nosso atendimento. Antes perdíamos leads, agora tudo está organizado e escalável.", stars: 5, photo: testimonialMaria },
    { name: "Carlos R.", role: "Diretor Comercial", text: "O CRM integrado com WhatsApp é incrível. Nosso time fecha mais negócios com muito menos esforço.", stars: 5, photo: testimonialCarlos },
    { name: "Ana P.", role: "Empreendedora", text: "As automações com IA são fantásticas. Respostas instantâneas 24h por dia sem perder a qualidade.", stars: 5, photo: testimonialAna },
    { name: "Juliana M.", role: "CEO de Agência Digital", text: "Conseguimos centralizar todo atendimento em um só lugar. A produtividade do time triplicou em 2 meses.", stars: 5, photo: testimonialJuliana },
    { name: "Roberto L.", role: "Gerente de Vendas", text: "O pipeline Kanban mudou nosso jogo. Agora temos previsibilidade de faturamento e controle total das vendas.", stars: 5, photo: testimonialRoberto },
    { name: "Fernanda C.", role: "Coordenadora de CS", text: "Os disparos em massa com segmentação são perfeitos. Nossas campanhas de reengajamento dobraram os resultados.", stars: 5, photo: testimonialFernanda },
    { name: "Lucas T.", role: "Founder de Startup", text: "A agenda inteligente com links de agendamento eliminou 90% do trabalho manual da minha equipe.", stars: 5, photo: testimonialLucas },
    { name: "Patrícia H.", role: "Diretora Financeira", text: "Ter o financeiro integrado com vendas e CRM nos dá uma visão 360° que antes era impossível de ter.", stars: 5, photo: testimonialPatricia },
];

export const HERO_SLIDES = [
    {
        bg: heroRobotBg,
        headline: <>Seu negócio no piloto automático com{" "}<span className="text-emerald-500">IA e automação</span></>,
        subtitle: "CRM, WhatsApp, Automações Inteligentes, Agenda, Financeiro e muito mais — tudo em uma só plataforma. Escale sem complicar.",
    },
    {
        bg: heroAtendimentoBg,
        headline: <>A plataforma de{" "}<span className="text-emerald-500">Gestão de Atendimento</span> mais completa do mercado</>,
        subtitle: "Centralize WhatsApp, organize equipes, automatize respostas e transforme conversas em vendas. Tudo em um único lugar, sem complicação.",
    },
];
