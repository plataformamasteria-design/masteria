import { Shield } from "lucide-react";
import SiteLayout, { useSiteThemeContext } from "@/components/site/SiteLayout";

function PrivacyContent() {
  const { isDark } = useSiteThemeContext();
  const mutedText = isDark ? "text-[#8892a8]" : "text-[#5a6478]";
  const heading = isDark ? "text-[#e8ecf4]" : "text-[#1a1f2e]";
  const accent = isDark ? "text-emerald-400" : "text-emerald-600";
  const cardBg = isDark ? "bg-[#111827]/40 border-[#1e2a3a]" : "bg-white border-[#e5e8ee]";
  const sectionBg = isDark ? "bg-[#0d1220]" : "bg-[#f0f2f7]";

  const sections = [
    { title: "1. Introdução", content: "A Vitta é comprometida com a proteção da privacidade dos usuários. Esta Política descreve como coletamos, usamos, armazenamos e protegemos informações pessoais na plataforma de gestão multicanal, CRM, automações e agentes de IA." },
    { title: "2. Dados que Coletamos", content: "Coletamos: dados de cadastro (nome, e-mail, telefone, senha, foto); dados organizacionais (configurações, equipes, funis, tags, campos customizados); dados de comunicação (mensagens WhatsApp, chat interno, disparos); dados de leads (telefones, fotos, histórico, tags, funis); dados de automação (fluxos, logs, estatísticas); dados de IA (prompts, credenciais criptografadas, memória, tokens); dados financeiros (transações, cobranças MercadoPago); dados de agendamento (calendários, bookings); dados de uso (logs, presença, permissões)." },
    { title: "3. Como Usamos seus Dados", content: "Para fornecer serviços (chat, CRM, automações, follow-up, disparos, agenda, financeiro); processar mensagens via WhatsApp APIs; executar automações e IA; gerenciar tokens; gerar relatórios e dashboards; processar cobranças; enviar webhooks; melhorar experiência e segurança." },
    { title: "4. Compartilhamento de Dados", content: "Com: Supabase (infraestrutura); Evolution API, Z-API, Meta/WhatsApp Cloud API (mensageria); OpenAI e Google AI (processamento IA); Google Calendar/Business; MercadoPago (pagamentos); webhooks externos configurados pela organização. Não vendemos dados pessoais." },
    { title: "5. Armazenamento e Segurança", content: "Criptografia em trânsito (TLS/SSL). Autenticação via Supabase Auth com JWT. Controle por papéis (superadmin, admin, atendente). Isolamento multi-tenant com Row Level Security. Senhas com hash bcrypt. API keys de IA criptografadas. Heartbeat de 45s para sessões." },
    { title: "6. Seus Direitos (LGPD)", content: "Conforme Lei nº 13.709/2018: acesso, correção, exclusão, revogação de consentimento, portabilidade, informações sobre compartilhamento e tratamento automatizado por IA." },
    { title: "7. Retenção de Dados", content: "Mantemos dados enquanto a conta estiver ativa. Após exclusão, dados removidos em até 30 dias, exceto obrigação legal." },
    { title: "8. Cookies e Armazenamento Local", content: "Usamos localStorage/sessionStorage para sessões JWT, preferências de tema e idioma, organização ativa e cache de permissões. Sem cookies de rastreamento de terceiros." },
    { title: "9. Dados de Inteligência Artificial", content: "Conteúdo de mensagens pode ser enviado a provedores de IA para respostas automáticas. Prompts configurados pela organização. Memória armazenada localmente. Consumo de tokens monitorado. Credenciais nunca expostas na interface." },
    { title: "10. Widget Público", content: "O widget de agendamento coleta nome, telefone e opcionalmente e-mail/notas. Tokens de cancelamento gerados para segurança. Dados sujeitos a esta Política." },
    { title: "11. Alterações", content: "Podemos atualizar esta política. Alterações significativas serão comunicadas via plataforma." },
    { title: "12. Contato", content: "Para exercer direitos ou esclarecer dúvidas, entre em contato pelos canais da plataforma ou com o administrador da organização." },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
          <Shield className={`h-6 w-6 ${accent}`} />
        </div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight">Política de Privacidade</h1>
        <p className={`mt-2 text-[13px] ${mutedText}`}>Última atualização: 3 de março de 2026</p>
      </div>

      <div className="space-y-6">
        {sections.map((s, i) => (
          <div
            key={s.title}
            className={`rounded-2xl border p-6 transition-colors ${i % 2 === 0 ? cardBg : `${sectionBg} ${isDark ? "border-[#1e2a3a]" : "border-[#e5e8ee]"}`}`}
          >
            <h2 className={`text-[15px] font-semibold mb-3 ${heading}`}>{s.title}</h2>
            <p className={`text-[13px] leading-relaxed font-light ${mutedText}`}>{s.content}</p>
          </div>
        ))}
      </div>

      <div className={`mt-12 pt-6 border-t text-center text-[11px] ${isDark ? "border-[#1e2a3a]" : "border-[#e5e8ee]"} ${mutedText}`}>
        © 2026 Vitta. Todos os direitos reservados.
      </div>
    </div>
  );
}

export default function Privacy() {
  return (
    <SiteLayout>
      <PrivacyContent />
    </SiteLayout>
  );
}
