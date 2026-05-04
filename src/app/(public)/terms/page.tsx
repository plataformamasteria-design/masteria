import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfUsePage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/login">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Termos de Serviço</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Termos e Condições</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
                <h3 className="text-foreground font-semibold">1. Termos</h3>
                <p>
                  Ao acessar ao site <strong>MASTERIA.app</strong>, concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis e concorda que é responsável pelo cumprimento de todas as leis locais aplicáveis. Se você não concordar com algum desses termos, está proibido de usar ou acessar este site. Os materiais contidos neste site são protegidos pelas leis de direitos autorais e marcas comerciais aplicáveis.
                </p>

                <h3 className="text-foreground font-semibold">2. Uso de Licença</h3>
                <p>
                  É concedida permissão para baixar temporariamente uma cópia dos materiais (informações ou software) no site MASTERIA.app, apenas para visualização transitória pessoal e não comercial. Esta é a concessão de uma licença, não uma transferência de título e, sob esta licença, você não pode: 
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>modificar ou copiar os materiais;</li>
                  <li>usar os materiais para qualquer finalidade comercial ou para exibição pública (comercial ou não comercial);</li>
                  <li>tentar descompilar ou fazer engenharia reversa de qualquer software contido no site MASTERIA.app;</li>
                  <li>remover quaisquer direitos autorais ou outras notações de propriedade dos materiais; ou</li>
                  <li>transferir os materiais para outra pessoa ou &#39;espelhe&#39; os materiais em qualquer outro servidor.</li>
                </ul>
                <p>
                  Esta licença será automaticamente rescindida se você violar alguma dessas restrições e poderá ser rescindida por MASTERIA.app a qualquer momento.
                </p>

                <h3 className="text-foreground font-semibold">3. Isenção de responsabilidade</h3>
                <p>
                  Os materiais no site da MASTERIA.app são fornecidos &#39;como estão&#39;. MASTERIA.app não oferece garantias, expressas ou implícitas, e, por este meio, isenta e nega todas as outras garantias, incluindo, sem limitação, garantias implícitas ou condições de comercialização, adequação a um fim específico ou não violação de propriedade intelectual ou outra violação de direitos.
                </p>

                <h3 className="text-foreground font-semibold">4. Limitações</h3>
                <p>
                  Em nenhum caso o MASTERIA.app ou seus fornecedores serão responsáveis por quaisquer danos (incluindo, sem limitação, danos por perda de dados ou lucro ou devido a interrupção dos negócios) decorrentes do uso ou da incapacidade de usar os materiais em MASTERIA.app.
                </p>

                <h3 className="text-foreground font-semibold">5. Precisão dos materiais</h3>
                <p>
                  Os materiais exibidos no site da MASTERIA.app podem incluir erros técnicos, tipográficos ou fotográficos. MASTERIA.app não garante que qualquer material em seu site seja preciso, completo ou atual. MASTERIA.app pode fazer alterações nos materiais contidos em seu site a qualquer momento, sem aviso prévio.
                </p>

                <h3 className="text-foreground font-semibold">6. Links</h3>
                <p>
                  O MASTERIA.app não analisou todos os sites vinculados ao seu site e não é responsável pelo conteúdo de nenhum site vinculado. A inclusão de qualquer link não implica endosso por MASTERIA.app do site. O uso de qualquer site vinculado é por conta e risco do usuário.
                </p>

                <h3 className="text-foreground font-semibold">Modificações</h3>
                <p>
                  O MASTERIA.app pode revisar estes termos de serviço do site a qualquer momento, sem aviso prévio. Ao usar este site, você concorda em ficar vinculado à versão atual desses termos de serviço.
                </p>

                <h3 className="text-foreground font-semibold">Lei Aplicável</h3>
                <p>
                  Estes termos e condições são regidos e interpretados de acordo com as leis do MASTERIA.app e você se submete irrevogavelmente à jurisdição exclusiva dos tribunais naquele estado ou localidade.
                </p>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:underline">Política de Privacidade</Link>
          <span className="mx-2">•</span>
          <Link href="/login" className="hover:underline">Voltar ao Login</Link>
        </div>
      </div>
    </div>
  );
}
