import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade | MasterIA',
  description: 'Política de Privacidade da plataforma MasterIA.',
};

export default function PoliticasPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="flex items-center gap-2 mb-12 border-b pb-8">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
            <p className="text-slate-500 mt-1">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </header>

        <main className="prose prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
            <p>
              A <strong>MasterIA</strong> ("nós", "nosso", "plataforma") leva a sua privacidade a sério. 
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos as suas 
              informações pessoais e os dados de sua empresa ao utilizar nossos serviços, incluindo a integração 
              com serviços de terceiros como a Meta (Facebook, Instagram, WhatsApp), Google e Kommo.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Coleta de Dados</h2>
            <p>Podemos coletar os seguintes tipos de informações:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li><strong>Dados de Registro:</strong> Nome, endereço de e-mail, informações da empresa e credenciais de login.</li>
              <li><strong>Dados de Integração:</strong> Tokens de acesso, IDs de contas de anúncios e dados analíticos (apenas quando você autoriza explicitamente a conexão com plataformas parceiras como a Meta).</li>
              <li><strong>Dados de Uso:</strong> Informações sobre como você interage com a nossa plataforma.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. Uso das Informações</h2>
            <p>Utilizamos os dados coletados para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Fornecer, operar e manter os serviços da MasterIA;</li>
              <li>Processar as integrações autorizadas por você (ex: exibir métricas de campanhas do Meta Ads no seu dashboard);</li>
              <li>Melhorar e personalizar a experiência do usuário;</li>
              <li>Garantir a segurança e integridade das contas;</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Integração com Serviços da Meta (Facebook/WhatsApp)</h2>
            <p>
              Para fornecer nossos serviços de automação e análise de tráfego, a MasterIA solicita acesso 
              às APIs da Meta. <strong>Apenas acessamos os dados que você explicitamente autorizar</strong> através da 
              janela de consentimento do OAuth. Nós <strong>não vendemos</strong> seus dados oriundos do Facebook ou 
              WhatsApp, e eles são utilizados estritamente para exibir informações no seu próprio dashboard ou 
              permitir que as suas automações funcionem conforme você as configurou.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Compartilhamento de Dados</h2>
            <p>
              Nós não compartilhamos suas informações pessoais com terceiros, exceto nos seguintes casos:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-2">
              <li>Com o seu consentimento explícito;</li>
              <li>Para provedores de infraestrutura estritamente necessários para operar a plataforma;</li>
              <li>Para cumprir ordens judiciais ou exigências legais.</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Segurança</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizacionais avançadas para proteger seus 
              dados contra acesso, alteração, divulgação ou destruição não autorizada. As credenciais e tokens 
              de integração (como o token da Meta) são criptografados antes de serem armazenados em nossos bancos de dados.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Seus Direitos</h2>
            <p>
              Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento. 
              Para integrações (como o Meta Ads), você pode revogar o acesso diretamente nas configurações da 
              MasterIA ou no painel de segurança da própria plataforma de origem (ex: Configurações do Facebook).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Contato</h2>
            <p>
              Se você tiver dúvidas sobre esta Política de Privacidade, entre em contato conosco através do 
              suporte da plataforma ou pelo e-mail oficial da empresa.
            </p>
          </section>
        </main>

        <footer className="mt-16 pt-8 border-t text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} MasterIA. Todos os direitos reservados.</p>
          <div className="mt-4 space-x-4">
            <Link href="/" className="hover:text-blue-600 transition-colors">Voltar para a página inicial</Link>
            <span>•</span>
            <Link href="/termos" className="hover:text-blue-600 transition-colors">Termos de Uso</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
