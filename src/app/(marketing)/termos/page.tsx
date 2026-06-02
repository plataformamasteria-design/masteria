import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Serviço | MasterIA',
  description: 'Termos e Condições de Uso da plataforma MasterIA.',
};

export default function TermosPage() {
  return (
    <div className="relative z-10 w-full min-h-screen flex items-center justify-center py-20 px-4">
      <div className="w-full max-w-4xl bg-zinc-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-8 md:p-12">
        <header className="flex items-center gap-4 mb-12 border-b border-white/10 pb-8">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.1)]">
            <FileText className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Termos de Serviço</h1>
            <p className="text-zinc-400 mt-1">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </header>

        <main className="prose prose-invert prose-zinc max-w-none prose-p:text-zinc-400 prose-headings:text-white prose-strong:text-emerald-400">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e usar a plataforma <strong>MasterIA</strong>, você concorda em cumprir e estar vinculado 
              a estes Termos de Serviço. Se você não concordar com qualquer parte destes termos, você não poderá 
              acessar o serviço.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Descrição do Serviço</h2>
            <p>
              A MasterIA fornece uma plataforma de gestão, automação de processos e análise de dados (incluindo tráfego pago) 
              projetada para ajudar empresas a otimizarem suas operações. O serviço inclui conexões com provedores terceiros 
              (como Meta, Google, Kommo, entre outros) autorizadas expressamente pelo usuário.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Contas de Usuário</h2>
            <p>
              Você é o único responsável por manter a confidencialidade de sua conta e senha, e por restringir 
              o acesso ao seu computador ou dispositivo. Você concorda em aceitar a responsabilidade por todas as 
              atividades que ocorram em sua conta. A MasterIA reserva-se o direito de recusar o serviço, encerrar contas, 
              remover ou editar conteúdo a seu critério exclusivo se houver violação destes Termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Integrações e APIs de Terceiros</h2>
            <p>
              Nosso serviço permite que você conecte contas de serviços de terceiros (ex: Facebook Ads, WhatsApp API). 
              Ao utilizar essas integrações:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-zinc-400">
              <li>Você confirma que tem permissão legal e autoridade para acessar e vincular essas contas à MasterIA.</li>
              <li>A MasterIA não se responsabiliza pelas políticas, disponibilidade ou mudanças nas APIs desses provedores terceiros.</li>
              <li>Você concorda em cumprir os Termos de Serviço e Políticas das plataformas integradas (como os <a href="https://developers.facebook.com/terms/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 hover:underline">Termos da Plataforma Meta</a>).</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Propriedade Intelectual</h2>
            <p>
              A plataforma, seus recursos originais, funcionalidade e design são de propriedade exclusiva da MasterIA 
              e são protegidos por direitos autorais, marcas registradas e outras leis de propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Limitação de Responsabilidade</h2>
            <p>
              Em nenhuma circunstância a MasterIA, seus diretores, funcionários, parceiros, agentes ou afiliados 
              serão responsáveis por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos, 
              incluindo, sem limitação, perda de lucros, dados, uso, boa vontade ou outras perdas intangíveis, 
              resultantes de:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2 text-zinc-400">
              <li>Seu acesso ou uso ou incapacidade de acessar ou usar o Serviço;</li>
              <li>Qualquer conduta ou conteúdo de terceiros no Serviço;</li>
              <li>Acesso, uso ou alteração não autorizados de suas transmissões ou conteúdo.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Modificações dos Termos</h2>
            <p>
              Reservamo-nos o direito, a nosso exclusivo critério, de modificar ou substituir estes Termos a qualquer momento. 
              Se uma revisão for material, tentaremos fornecer um aviso com pelo menos 30 dias de antecedência antes que 
              quaisquer novos termos entrem em vigor. O uso contínuo do nosso Serviço após essas revisões entrarem em vigor 
              constitui a aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Contato</h2>
            <p>
              Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco através dos canais de suporte 
              oficiais da plataforma.
            </p>
          </section>
        </main>

        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} MasterIA. Todos os direitos reservados.</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors">Voltar para a página inicial</Link>
            <span>•</span>
            <Link href="/politicas" className="text-emerald-400 hover:text-emerald-300 transition-colors">Política de Privacidade</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
