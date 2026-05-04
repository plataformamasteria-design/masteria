import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section id="hero" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter leading-tight text-foreground">
              Automatize seu WhatsApp e Transforme Conversas em Vendas.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto md:mx-0">
              Crie campanhas, gerencie atendimentos com um CRM completo e utilize o poder da IA para nunca mais perder um cliente.
            </p>
            <div className="mt-8">
              <Link href="/register" passHref>
                <Button size="lg">Comece Grátis por 7 dias</Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <Image
              src="/screenshot2.png"
              alt="Dashboard Master IA"
              width={1200}
              height={800}
              className="rounded-lg shadow-2xl"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
