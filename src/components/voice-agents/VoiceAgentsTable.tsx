'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2, Bot, Phone, ArrowRightLeft } from 'lucide-react';
import { VoiceAgent } from '@/hooks/useVoiceAgents';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface VoiceAgentsTableProps {
  agents: VoiceAgent[];
  loading: boolean;
  onEdit: (agent: VoiceAgent) => void;
  onDelete: (id: string) => Promise<boolean>;
}

const typeIcons = {
  inbound: Phone,
  outbound: Bot,
  transfer: ArrowRightLeft,
};

const typeLabels = {
  inbound: 'Receptivo',
  outbound: 'Ativo',
  transfer: 'Transferência',
};

const statusColors = {
  active: 'bg-green-500/10 text-green-500 border-green-500/20',
  inactive: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  archived: 'bg-muted/50 text-muted-foreground border-border',
};

const statusLabels = {
  active: 'Ativo',
  inactive: 'Inativo',
  archived: 'Arquivado',
};

export function VoiceAgentsTable({ agents, loading, onEdit, onDelete }: VoiceAgentsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<VoiceAgent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClick = (agent: VoiceAgent) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;
    setDeleting(true);
    const success = await onDelete(agentToDelete.id);
    setDeleting(false);
    if (success) {
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum agente encontrado</h3>
        <p className="text-muted-foreground">
          Crie seu primeiro agente de voz para começar.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const TypeIcon = typeIcons[agent.type];
              return (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      {agent.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4" />
                      {typeLabels[agent.type]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[agent.status]}>
                      {statusLabels[agent.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {agent.llmModel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(agent.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(agent)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(agent)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agente &quot;{agentToDelete?.name}&quot;?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
