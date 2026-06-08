

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, MoreVertical, PlusCircle, Trash, Edit, Users, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { KanbanFunnel } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import Link from 'next/link';
import { ImportKommoModal } from './import-kommo-modal';
import { UnassignedLeadsDrawer } from './unassigned-leads-drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


export function FunnelList() {
  const [funnels, setFunnels] = useState<KanbanFunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();

  const fetchFunnels = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/kanbans');
      if (!response.ok) {
        throw new Error('Não foi possível carregar os funis.');
      }
      const data = await response.json();
      setFunnels(data);
    } catch (error) {
      notify.error('Erro ao Carregar Funis', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (funnelId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/v1/kanbans/${funnelId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Falha ao excluir o funil.');
      }
      notify.success('Funil Excluído!', 'O funil foi removido com sucesso.');
      await fetchFunnels();
    } catch (error) {
      notify.error('Erro ao Excluir', (error as Error).message);
    }
  };

  return (
    <div className="h-full overflow-y-auto premium-scrollbar p-4 sm:p-6 md:p-8 pb-24 md:pb-8">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Filter className="h-6 w-6" /> Funis Kanban
        </h2>
        <div className="flex items-center gap-2">
          <UnassignedLeadsDrawer funnels={funnels} />
          <ImportKommoModal />
          <Link href="/kanban/new" passHref>
            <Button className="w-full sm:w-auto rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all">
              <PlusCircle className="mr-2 h-4 w-4" />
              Criar Funil
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : funnels.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
          <h3 className="text-lg font-semibold">Nenhum Funil Criado</h3>
          <p>Crie seu primeiro funil para organizar seus leads.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {funnels.map((funnel) => (
            <div
              key={funnel.id}
              className="group relative rounded-3xl glass-card p-6 transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.04] hover:border-black/20 dark:hover:border-white/20 hover:shadow-2xl"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/kanban/${funnel.id}/edit`)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                        <Trash className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>Deseja excluir o funil &quot;{funnel.name}&quot;? Todos os leads associados também serão removidos. Esta ação é irreversível.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(funnel.id)}>Sim, Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link href={`/kanban/${funnel.id}`} passHref>
                <div className="cursor-pointer">
                  <h3 className="text-xl font-bold text-foreground/90 group-hover:text-emerald-400 transition-colors duration-300">{funnel.name}</h3>
                  <div className="mt-5 flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 opacity-70" />
                      <span className="text-sm font-medium">{(funnel.totalLeads || 0).toLocaleString()} Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 opacity-70 text-emerald-500" />
                      <span className="text-sm font-bold text-emerald-500/90">{(funnel.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
