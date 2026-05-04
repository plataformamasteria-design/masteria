import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/login">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>MASTERIA.app</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
                <p>
                  A sua privacidade é importante para nós. É política do <strong>MASTERIA.app</strong> respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar no site MASTERIA.app, e outros sites que possuímos e operamos.
                </p>
                
                <p>
                  Solicitamos informações pessoais apenas quando realmente precisamos delas para lhe fornecer um serviço. Fazemo-lo por meios justos e legais, com o seu conhecimento e consentimento. Também informamos por que estamos coletando e como será usado.
                </p>

                <h3 className="text-foreground font-semibold">Coleta de Informações</h3>
                <p>
                  Apenas retemos as informações coletadas pelo tempo necessário para fornecer o serviço solicitado. Quando armazenamos dados, os protegemos dentro de meios comercialmente aceitáveis para evitar perdas e roubos, bem como acesso, divulgação, cópia, uso ou modificação não autorizados.
                </p>

                <h3 className="text-foreground font-semibold">Compartilhamento de Dados</h3>
                <p>
                  Não compartilhamos informações de identificação pessoal publicamente ou com terceiros, exceto quando exigido por lei.
                </p>

                <h3 className="text-foreground font-semibold">Links para Sites Externos</h3>
                <p>
                  O nosso site pode ter links para sites externos que não são operados por nós. Esteja ciente de que não temos controle sobre o conteúdo e práticas desses sites e não podemos aceitar responsabilidade por suas respectivas políticas de privacidade.
                </p>

                <h3 className="text-foreground font-semibold">Compromisso do Usuário</h3>
                <p>
                  O usuário se compromete a fazer uso adequado dos conteúdos e da informação que o MASTERIA.app oferece no site e com caráter enunciativo, mas não limitativo:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Não se envolver em atividades que sejam ilegais ou contrárias à boa fé a à ordem pública;</li>
                  <li>Não difundir propaganda ou conteúdo de natureza racista, xenofóbica, ou sobre cassinos, casas de apostas, qualquer tipo de pornografia ilegal, de apologia ao terrorismo ou contra os direitos humanos;</li>
                  <li>Não causar danos aos sistemas físicos (hardwares) e lógicos (softwares) do MASTERIA.app, de seus fornecedores ou terceiros.</li>
                </ul>

                <h3 className="text-foreground font-semibold">Mais informações</h3>
                <p>
                  Esperemos que esteja esclarecido e, como mencionado anteriormente, se houver algo que você não tem certeza se precisa ou não, geralmente é mais seguro deixar os cookies ativados, caso interaja com um dos recursos que você usa em nosso site.
                </p>

                <p className="text-sm italic pt-4">
                  Esta política é efetiva a partir de Janeiro/2026.
                </p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        <div className="text-center text-sm text-muted-foreground">
          <Link href="/terms" className="hover:underline">Termos de Uso</Link>
          <span className="mx-2">•</span>
          <Link href="/login" className="hover:underline">Voltar ao Login</Link>
        </div>
      </div>
    </div>
  );
}
