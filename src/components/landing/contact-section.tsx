import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const faqs = [
  {
    question: 'O ZAP Master é seguro?',
    answer: 'Sim. Utilizamos a API oficial do WhatsApp (Meta), garantindo total conformidade e segurança. Seus dados e os de seus clientes são criptografados e protegidos.',
  },
  {
    question: 'Preciso ter conhecimento técnico para usar?',
    answer: 'Não! Nossa plataforma foi projetada para ser intuitiva e fácil de usar. Você pode criar campanhas e configurar a IA sem precisar escrever uma linha de código.',
  },
  {
    question: 'Como funciona a cobrança?',
    answer: 'Nossos planos são baseados em uma assinatura mensal ou anual, sem taxas ocultas. Você pode cancelar a qualquer momento. O plano Enterprise possui um modelo de cobrança customizado.',
  },
  {
    question: 'Posso integrar com outras ferramentas?',
    answer: 'Sim! A nossa IA permite a conexão com ferramentas externas através de endpoints, possibilitando integrações avançadas com seus sistemas existentes.',
  }
];

export function ContactSection() {
  return (
    <section id="contact" className="py-16 sm:py-24 bg-background border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ainda tem dúvidas?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Fale conosco ou confira nossas perguntas frequentes.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16">
          <div>
            <h3 className="text-2xl font-bold mb-6 text-foreground">Envie uma Mensagem</h3>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Nome</Label>
                <Input id="name" placeholder="Seu nome" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input id="email" type="email" placeholder="seu@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-foreground">Mensagem</Label>
                <Textarea id="message" placeholder="Sua pergunta aqui..." rows={5} />
              </div>
              <Button type="submit" className="w-full">Enviar Mensagem</Button>
            </form>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-6 text-foreground">Perguntas Frequentes (FAQ)</h3>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-b-border">
                  <AccordionTrigger className="text-left text-foreground hover:text-primary">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
