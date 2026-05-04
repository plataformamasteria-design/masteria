
'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const plans = [
  {
    name: 'Essencial',
    price: { monthly: 'R$ 99', yearly: 'R$ 990' },
    description: 'Para pequenos negócios e equipes começando.',
    features: ['1 Conexão WhatsApp', '2 Usuários', 'Campanhas Básicas', '1 Persona de IA'],
    popular: false,
  },
  {
    name: 'Profissional',
    price: { monthly: 'R$ 249', yearly: 'R$ 2490' },
    description: 'Para equipes em crescimento que precisam de mais poder.',
    features: ['5 Conexões WhatsApp', '10 Usuários', 'CRM Completo com Kanban', '5 Personas de IA', 'Relatórios Avançados'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: { monthly: 'Customizado', yearly: 'Customizado' },
    description: 'Para grandes operações com necessidades específicas.',
    features: ['Conexões Ilimitadas', 'Usuários Ilimitados', 'Suporte Dedicado 24/7', 'Onboarding Personalizado'],
    popular: false,
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="pricing" className="py-20 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Escolha o Plano Perfeito para o seu Negócio
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            Comece com o que você precisa e expanda conforme seu crescimento.
          </p>
        </div>

        <div className="flex justify-center items-center gap-4 mb-10">
          <Label htmlFor="billing-cycle" className="font-medium">Mensal</Label>
          <Switch id="billing-cycle" checked={isYearly} onCheckedChange={setIsYearly} aria-label="Alterar para cobrança anual" />
          <Label htmlFor="billing-cycle" className="font-medium">
            Anual <span className="text-primary font-semibold">(2 meses grátis)</span>
          </Label>
        </div>

        <div className="grid max-w-md grid-cols-1 gap-8 mx-auto lg:max-w-none lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn(
                'flex flex-col overflow-hidden rounded-lg shadow-lg',
                plan.popular ? 'border-2 border-primary ring-2 ring-primary' : 'border'
              )}
            >
              {plan.popular && (
                <div className="bg-primary text-center py-2 text-sm font-semibold text-primary-foreground">
                  MAIS POPULAR
                </div>
              )}
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-semibold">{plan.name}</CardTitle>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-8">
                <div className="mb-6">
                  <span className="text-5xl font-extrabold text-gray-900">
                    {isYearly ? plan.price.yearly : plan.price.monthly}
                  </span>
                  {plan.name !== 'Enterprise' && (
                    <span className="text-lg font-medium text-gray-500">
                      / {isYearly ? 'ano' : 'mês'}
                    </span>
                  )}
                </div>
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="h-6 w-6 flex-shrink-0 text-primary mr-3" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-8 mt-auto">
                <Link href="/register" passHref className="w-full">
                  <Button size="lg" className="w-full" variant={plan.popular ? 'default' : 'outline'}>
                    {plan.name === 'Enterprise' ? 'Entre em Contato' : 'Começar Agora'}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
