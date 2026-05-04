// src/app/(main)/roadmap/page.tsx
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lightbulb, Rocket, Users, GitBranch, Mail, Handshake, LayoutDashboard, History } from 'lucide-react';
import { Button } from '@/components/ui/button';

const futureFeatures = [
    { 
        icon: Users, 
        title: 'Assistente de Segmentação',
        description: 'Uma IA para ajudar a criar públicos e segmentar contatos para campanhas usando linguagem natural.'
    },
    {
        icon: GitBranch,
        title: 'Automações com React Flow',
        description: 'Reintrodução do construtor visual de fluxos de automação para criar lógicas complexas de atendimento e marketing.'
    },
    {
        icon: History,
        title: 'Logs de Automação',
        description: 'Um painel para visualizar o histórico de todas as automações executadas, facilitando a depuração e o acompanhamento das regras.'
    },
    {
        icon: Handshake,
        title: 'Integrações com CRMs Externos',
        description: 'Conexão e sincronização de dados com plataformas como a Kommo CRM.'
    },
    {
        icon: LayoutDashboard,
        title: 'Gestão de Funis (Kanban)',
        description: 'Criação de painéis Kanban para visualizar e gerir o fluxo de atendimento ou vendas, desde o primeiro contato até a conversão.'
    }
];

export default function RoadmapPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Roadmap e Futuras Funcionalidades"
        description="A nossa visão para o futuro da plataforma e como você pode participar."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Rocket className="h-6 w-6 text-primary" />
                        Próximas Funcionalidades
                    </CardTitle>
                    <CardDescription>
                        Estas são as principais funcionalidades que foram adiadas para garantir a estabilidade do MVP e que estão no nosso radar para desenvolvimento futuro.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {futureFeatures.map(feature => (
                         <div key={feature.title} className="flex items-start gap-4 p-3 bg-muted/50 rounded-lg">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-1">
                                <feature.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold">{feature.title}</h3>
                                <p className="text-sm text-muted-foreground">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-6 w-6 text-yellow-500" />
                        Tem uma Sugestão?
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        A sua opinião é muito importante para nós! Se você tem uma ideia para uma nova funcionalidade ou uma melhoria, adoraríamos ouvir.
                    </p>
                    <a href="mailto:sugestoes@exemplo.com">
                        <Button className="w-full">
                            <Mail className="mr-2 h-4 w-4" />
                            Enviar Sugestão por E-mail
                        </Button>
                    </a>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
