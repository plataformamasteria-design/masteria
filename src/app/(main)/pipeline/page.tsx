import { Metadata } from 'next';
import { getKanbanFunnels, getKanbanStages, createFunnel, createFunnelStage } from '@/app/actions/kanban';
import { KanbanBoard } from '@/components/pipeline/kanban-board';
import { requireAuthOr401 } from '@/lib/api-auth-helper';
import { redirect } from 'next/navigation';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'CRM Pipeline | MasterIA',
  description: 'Gestão visual de leads em Kanban drag and drop',
};

async function ensureDefaultFunnel() {
  const funnels = await getKanbanFunnels();
  if (funnels.length > 0) return funnels;

  // Create default funnel with standard stages
  const newFunnel = await createFunnel("Funil Principal de Vendas");

  await Promise.all([
    createFunnelStage(newFunnel.id, "Lead Novo", "#3b82f6", 0),
    createFunnelStage(newFunnel.id, "Em Atendimento", "#f59e0b", 1),
    createFunnelStage(newFunnel.id, "Proposta Enviada", "#8b5cf6", 2),
    createFunnelStage(newFunnel.id, "Cliente Ganhos", "#10b981", 3),
    createFunnelStage(newFunnel.id, "Perdidos", "#ef4444", 4),
  ]);

  return [newFunnel];
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: { funnelId?: string };
}) {
  const auth = await requireAuthOr401();
  if ('status' in auth) redirect('/login');

  const funnels = await ensureDefaultFunnel();

  // Select funnel
  const currentFunnelId = searchParams.funnelId || funnels[0].id;
  const currentFunnel = funnels.find(f => f.id === currentFunnelId) || funnels[0];

  const initialStages = await getKanbanStages(currentFunnel.id);

  return (
    <div className="flex-1 w-full flex flex-col min-h-[calc(100vh-4rem)] relative p-4 lg:p-6 bg-zinc-50/50 dark:bg-zinc-950/50">
      {/* Header Pipeline */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            CRM Pipeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mova seus cards entre as etapas de fechamento
          </p>
        </div>

        <div className="flex items-center gap-3">
          {funnels.length > 1 && (
            <div className="bg-background rounded-md border flex text-sm overflow-hidden p-1 shadow-sm">
              {funnels.map(f => (
                <a
                  key={f.id}
                  href={`?funnelId=${f.id}`}
                  className={`px-3 py-1.5 rounded-sm transition-all ${f.id === currentFunnel.id ? 'bg-primary text-primary-foreground shadow' : 'hover:bg-muted text-muted-foreground'}`}
                >
                  {f.name}
                </a>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="h-9 glass border-primary/20 hover:bg-primary/5 text-primary">
            <Plus className="w-4 h-4 mr-2" /> Novo Funil
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-4 py-1.5 rounded-full border bg-muted/30 flex items-center gap-2">
          <ArrowRightLeft className="w-3 h-3" />
          {currentFunnel.name}
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <KanbanBoard funnelId={currentFunnel.id} initialStages={initialStages} />
      </div>
    </div>
  );
}
