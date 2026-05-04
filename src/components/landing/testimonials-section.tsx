
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

const testimonials = [
  {
    name: 'Ana Clara',
    company: 'Diretora, Varejo ABC',
    quote: '"O ZAP Master revolucionou nosso atendimento. A automação com IA nos economizou horas por dia e aumentou nossas vendas em 30%!"',
    avatar: 'https://placehold.co/100x100.png',
  },
  {
    name: 'Marcos Oliveira',
    company: 'CEO, Soluções Tech',
    quote: '"Finalmente uma plataforma que centraliza tudo. As campanhas são fáceis de criar e os relatórios nos dão a visibilidade que precisávamos."',
    avatar: 'https://placehold.co/100x100.png',
  },
  {
    name: 'Sofia Martins',
    company: 'Gerente, Clínica Bem Estar',
    quote: '"A gestão de atendimentos pelo Kanban é fantástica. Nossa equipe está mais organizada e nenhum paciente fica sem resposta."',
    avatar: 'https://placehold.co/100x100.png',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-gray-50 sm:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            O que nossos clientes dizem
          </h2>
          <p className="mt-4 text-lg leading-8 text-gray-600">
            Descubra como o ZAP Master está transformando a comunicação de empresas como a sua.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="overflow-hidden shadow-lg transition-transform duration-300 ease-in-out hover:-translate-y-2">
              <CardContent className="p-8">
                <blockquote className="text-lg text-gray-700 italic border-l-4 border-primary pl-4">
                  {testimonial.quote}
                </blockquote>
              </CardContent>
              <div className="p-6 pt-0 mt-4 flex items-center gap-4">
                <Image
                  src={testimonial.avatar}
                  alt={testimonial.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                  data-ai-hint="avatar user"
                />
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.company}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
