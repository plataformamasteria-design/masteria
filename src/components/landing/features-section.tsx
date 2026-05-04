import Image from 'next/image';
import { Send, LayoutGrid, Bot, BarChart } from 'lucide-react';

const features = [
  {
    icon: Send,
    title: 'Campanhas em Massa',
    description: 'Crie, agende e monitore campanhas de alto impacto com modelos pré-aprovados e personalização avançada.',
    image: 'https://placehold.co/800x600.png',
    imageHint: 'marketing campaign'
  },
  {
    icon: LayoutGrid,
    title: 'CRM com Kanban',
    description: 'Gerencie todos os seus atendimentos em um só lugar. Organize seus leads em um painel Kanban intuitivo e nunca perca uma oportunidade.',
    image: 'https://placehold.co/800x600.png',
    imageHint: 'kanban board'
  },
  {
    icon: Bot,
    title: 'IA Inteligente',
    description: 'Treine personas de IA para responder automaticamente, qualificar leads e transferir para humanos apenas quando necessário, 24/7.',
    image: 'https://placehold.co/800x600.png',
    imageHint: 'artificial intelligence'
  },
  {
    icon: BarChart,
    title: 'Relatórios Detalhados',
    description: 'Acompanhe o desempenho de suas campanhas e atendimentos com métricas claras sobre envios, entregas, leituras e conversões.',
    image: 'https://placehold.co/800x600.png',
    imageHint: 'analytics dashboard'
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 bg-muted/30 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Uma Plataforma Completa para o seu Sucesso no WhatsApp.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Todas as ferramentas que você precisa, em um só lugar.
          </p>
        </div>
        <div className="mt-20 space-y-20">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
            >
              <div className={index % 2 === 0 ? 'lg:order-2' : 'lg:order-1'}>
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-full">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{feature.title}</h3>
                </div>
                <p className="mt-4 text-muted-foreground text-lg">
                  {feature.description}
                </p>
              </div>
              <div className={index % 2 === 0 ? 'lg:order-1' : 'lg:order-2'}>
                <Image
                  src={feature.image}
                  alt={feature.title}
                  width={800}
                  height={600}
                  className="rounded-lg shadow-xl"
                  data-ai-hint={feature.imageHint}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
