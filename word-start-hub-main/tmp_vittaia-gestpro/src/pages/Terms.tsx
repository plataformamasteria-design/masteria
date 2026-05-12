import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import SiteLayout, { useSiteThemeContext } from "@/components/site/SiteLayout";

function TermsContent() {
  const { isDark } = useSiteThemeContext();
  const mutedText = isDark ? "text-[#8892a8]" : "text-[#5a6478]";
  const heading = isDark ? "text-[#e8ecf4]" : "text-[#1a1f2e]";
  const accent = isDark ? "text-emerald-400" : "text-emerald-600";
  const cardBg = isDark ? "bg-[#111827]/40 border-[#1e2a3a]" : "bg-white border-[#e5e8ee]";
  const sectionBg = isDark ? "bg-[#0d1220]" : "bg-[#f0f2f7]";

  const sections = [
    { title: "1. Aceitação dos Termos", content: "Ao acessar e utilizar a plataforma Vitta, você concorda com estes Termos de Uso. Se não concordar, não utilize a Plataforma. O uso continuado constitui aceitação integral." },
    { title: "2. Descrição do Serviço", content: "A Vitta é uma solução completa de gestão de atendimento, vendas e automação multicanal, incluindo Chat (WhatsApp via Evolution API, Z-API e Meta), CRM/Pipeline com kanban, Automações visuais com IA, Agentes de IA (OpenAI/Gemini), Follow-up automatizado, Disparos em massa, Agenda com bookings, Financeiro, Equipes, Dashboard analítico, E-mail, Google Business, Comandos Rápidos, Multi-Organização e interface em 7 idiomas." },
    { title: "3. Cadastro e Conta", content: "O acesso requer conta com e-mail e senha válidos. Você é responsável pela confidencialidade das credenciais. Compartilhamento de contas é proibido. Administradores definem permissões por página e função (admin, atendente). Trials podem ser oferecidos com funcionalidades limitadas." },
    { title: "4. Uso Aceitável", content: "Cumpra todas as leis (LGPD, Marco Civil, políticas WhatsApp Business). Não envie spam via Disparos ou Automações. Respeite limites de tokens de IA. Não realize engenharia reversa. Não compartilhe credenciais de API com terceiros. Mantenha dados de contatos em conformidade com consentimento. Use broadcast e follow-up de forma responsável." },
    { title: "5. Integrações e APIs", content: "Integrações incluem Evolution API, Z-API, Meta/WhatsApp Cloud API, Google Calendar, Google Business, OpenAI, Google AI (Gemini) e MercadoPago. A disponibilidade depende dos provedores. Você é responsável por credenciais de integração. Webhooks são de responsabilidade do usuário." },
    { title: "6. Planos, Tokens e Pagamentos", content: "Funcionalidades dependem do plano contratado. Tokens de IA são gerenciados por organização com limites configuráveis. Cobranças via MercadoPago. Inadimplência pode restringir funcionalidades conforme política de dunning." },
    { title: "7. Propriedade Intelectual", content: "A Plataforma é propriedade da Vitta. Dados inseridos pelos usuários permanecem propriedade das organizações. Licença limitada, não exclusiva e revogável para uso conforme estes termos." },
    { title: "8. Limitação de Responsabilidade", content: "Plataforma fornecida 'como está'. Não nos responsabilizamos por falhas de terceiros. Respostas de IA são responsabilidade da organização que configurou os prompts. Responsabilidade limitada ao valor pago nos últimos 12 meses." },
    { title: "9. Suspensão e Encerramento", content: "Podemos suspender contas que violem estes termos. Usuários podem solicitar encerramento. Organizações podem ser excluídas pelo superadministrador." },
    { title: "10. Alterações nos Termos", content: "Reservamo-nos o direito de modificar estes termos. Alterações significativas serão comunicadas com antecedência de 15 dias." },
    { title: "11. Disposições Gerais", content: "Regidos pelas leis do Brasil. Disputas resolvidas no foro da comarca da sede. Invalidade de cláusula não afeta as demais." },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-12">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4 ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
          <FileText className={`h-6 w-6 ${accent}`} />
        </div>
        <h1 className="text-3xl md:text-4xl font-light tracking-tight">Termos de Uso</h1>
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

export default function Terms() {
  return (
    <SiteLayout>
      <TermsContent />
    </SiteLayout>
  );
}
