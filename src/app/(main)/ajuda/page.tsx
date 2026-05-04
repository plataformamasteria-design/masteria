// src/app/(main)/ajuda/page.tsx
import { PageHeader } from '@/components/page-header'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Plug,
  MessageSquareText,
  Users,
  Send,
  ArrowRight,
  MessageCircle,
  BookUser,
  LayoutGrid,
} from 'lucide-react'
import { CreateSmsCampaignDialog } from '@/components/campaigns/create-sms-campaign-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const steps = [
  {
    icon: Plug,
    title: 'Passo 1: Conecte seu WhatsApp',
    description:
      'O primeiro e mais importante passo. Conecte sua conta da API oficial do WhatsApp para começar a enviar e receber mensagens.',
    link: '/connections',
    linkText: 'Gerenciar Conexões',
  },
  {
    icon: MessageSquareText,
    title: 'Passo 2: Sincronize seus Modelos',
    description:
      'Para enviar mensagens ativas (iniciar conversas), o WhatsApp exige que você use modelos pré-aprovados. Sincronize seus modelos para que apareçam na plataforma.',
    link: '/templates',
    linkText: 'Ver Modelos',
  },
  {
    icon: Users,
    title: 'Passo 3: Adicione seus Contatos',
    description:
      'Com a conexão ativa, é hora de adicionar seus clientes. Você pode adicioná-los manualmente ou importar uma lista em massa a partir de um ficheiro CSV.',
    link: '/contacts',
    linkText: 'Gerenciar Contatos',
  },
  {
    icon: Send,
    title: 'Passo 4: Crie sua Primeira Campanha',
    description:
      'Agora que está tudo pronto, crie sua primeira campanha para engajar seus clientes, seja por WhatsApp ou SMS.',
    link: '/campaigns',
    linkText: 'Criar Campanha',
  },
]

const faqs = [
  {
    question: 'O Master IA é seguro?',
    answer:
      'Sim. Utilizamos a API oficial do WhatsApp (Meta), garantindo total conformidade e segurança. Seus dados e os de seus clientes são criptografados e protegidos.',
  },
  {
    question: 'Preciso ter conhecimento técnico para usar?',
    answer:
      'Não! Nossa plataforma foi projetada para ser intuitiva e fácil de usar. Você pode criar campanhas e configurar a IA sem precisar escrever uma linha de código.',
  },
  {
    question: 'Como funciona a cobrança?',
    answer:
      'Nossos planos são baseados em uma assinatura mensal ou anual, sem taxas ocultas. Você pode cancelar a qualquer momento. O plano Enterprise possui um modelo de cobrança customizado.',
  },
  {
    question: 'Posso integrar com outras ferramentas?',
    answer:
      'Sim! A nossa plataforma permite a conexão com sistemas externos através de Webhooks, possibilitando integrações com seus sistemas existentes.',
  },
]

const ManualCompleto = () => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">Manual do Utilizador - Master IA</CardTitle>
      <CardDescription>
        Bem-vindo ao Master IA! Este manual foi criado para o guiar através de
        todas as funcionalidades da nossa plataforma, desde a configuração
        inicial até à gestão avançada das suas campanhas e atendimentos.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-8">
      <section id="manual-configuracao">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">
          1. Configuração Essencial
        </h3>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Para começar a usar a plataforma, siga estes passos cruciais para o
            funcionamento do sistema.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">1.1. Conectar seu WhatsApp</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-4">
              <li>
                Vá para a secção{' '}
                <Link
                  href="/connections"
                  className="text-primary hover:underline font-semibold"
                >
                  Conexões
                </Link>
                .
              </li>
              <li>
                Clique em <strong>&quot;Adicionar Nova Conexão&quot;</strong>.
              </li>
              <li>
                Preencha os dados fornecidos pelo seu painel da Meta: WABA ID,
                ID do Número, Token, etc.
              </li>
              <li>
                Após salvar, ative a conexão e clique em{' '}
                <strong>&quot;Sincronizar Webhook&quot;</strong>.
              </li>
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">1.2. Sincronizar Modelos de Mensagem</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-4">
              <li>
                Vá para a secção{' '}
                <Link
                  href="/templates"
                  className="text-primary hover:underline font-semibold"
                >
                  Modelos
                </Link>
                .
              </li>
              <li>
                Clique no botão <strong>&quot;Sincronizar&quot;</strong> para buscar todos os seus
                modelos pré-aprovados.
              </li>
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">1.3. Adicionar Contatos e Listas</h4>
            <p className="text-muted-foreground pl-4">
              Aceda a{' '}
              <Link
                href="/contacts"
                className="text-primary hover:underline font-semibold"
              >
                Leads &gt; Contatos
              </Link>{' '}
              para adicionar seus clientes, seja manualmente ou importando um
              ficheiro CSV em massa.
            </p>
            <p className="text-muted-foreground pl-4 mt-2">
              <strong>Importante:</strong> Para enviar campanhas, os contatos
              precisam estar organizados em{' '}
              <Link
                href="/lists"
                className="text-primary hover:underline font-semibold"
              >
                Listas
              </Link>
              . Crie listas como &quot;Clientes VIP&quot; ou &quot;Leads de Julho&quot; para
              segmentar seus envios.
            </p>
          </div>
        </div>
      </section>

      <section id="manual-funcionalidades">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">
          2. Funcionalidades Principais
        </h3>
        <div className="space-y-4 text-sm">
          <div className="space-y-1">
            <h4 className="font-semibold">Dashboard</h4>
            <p className="text-muted-foreground">
              O seu painel de controlo principal com KPIs, gráficos e atalhos
              rápidos para as principais ações.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold">Campanhas (WhatsApp e SMS)</h4>
            <p className="text-muted-foreground">
              Para criar uma campanha, você precisa de um{' '}
              <strong>Modelo</strong> (para WhatsApp) e uma{' '}
              <strong>Lista de Contatos</strong>. Vá para a secção de Modelos ou
              SMS, escolha a opção de criar campanha e selecione o seu
              público-alvo (a lista). Você pode agendar o envio ou disparar
              imediatamente.
            </p>
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold">Atendimentos</h4>
            <p className="text-muted-foreground">
              Uma caixa de entrada unificada para gerir todas as suas conversas
              em tempo real, com um painel de detalhes do contato para dar mais
              contexto aos seus atendentes.
            </p>
          </div>
        </div>
      </section>

      <section id="manual-suporte">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">
          3. Perguntas Frequentes (FAQ)
        </h3>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </CardContent>
  </Card>
)

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Ajuda e Documentação"
        description="Seja bem-vindo(a)! Use o guia rápido para começar ou consulte o manual completo para mais detalhes."
      />

      <Tabs defaultValue="getting-started">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="getting-started">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Primeiros Passos
          </TabsTrigger>
          <TabsTrigger value="full-manual">
            <BookUser className="mr-2 h-4 w-4" />
            Manual Completo
          </TabsTrigger>
        </TabsList>
        <TabsContent value="getting-started" className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {steps.map((step, index) => (
              <Card key={index} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>{step.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription>{step.description}</CardDescription>
                </CardContent>
                <CardFooter>
                  {step.title.includes('Passo 4') ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          {step.linkText}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Qual tipo de campanha você deseja criar?
                          </DialogTitle>
                          <DialogDescription>
                            Escolha o canal para iniciar a criação da sua
                            campanha.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                          <Link href="/templates" passHref>
                            <Button
                              variant="outline"
                              className="w-full h-20 flex-col gap-2"
                            >
                              <MessageSquareText className="h-6 w-6 text-green-500" />
                              <span className="text-base">WhatsApp</span>
                            </Button>
                          </Link>
                          <CreateSmsCampaignDialog>
                            <Button
                              variant="outline"
                              className="w-full h-20 flex-col gap-2"
                            >
                              <MessageCircle className="h-6 w-6 text-blue-500" />
                              <span className="text-base">SMS</span>
                            </Button>
                          </CreateSmsCampaignDialog>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Link href={step.link} passHref className="w-full">
                      <Button variant="outline" className="w-full">
                        {step.linkText}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="full-manual" className="pt-6">
          <ManualCompleto />
        </TabsContent>
      </Tabs>
    </div>
  )
}
