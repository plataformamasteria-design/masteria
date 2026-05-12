

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Filter className="h-6 w-6" /> Funis Kanban
        </h2>
        <div className="flex items-center gap-2">
          <ImportKommoModal />
          <Link href="/kanban/new" passHref>
            <Button>
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
              className="group relative rounded-lg border bg-card p-5 shadow-sm transition-all hover:shadow-md"
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
                  <h3 className="text-lg font-bold text-primary">{funnel.name}</h3>
                  <div className="mt-4 flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">{(funnel.totalLeads || 0).toLocaleString()} Leads</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">{(funnel.totalValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
