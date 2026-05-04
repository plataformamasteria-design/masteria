

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Copy, Trash2, Loader2, Bot, FileText } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Persona } from '@/lib/types';
import { createToastNotifier } from '@/lib/toast-helper';
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
import { useToast } from '@/hooks/use-toast';
import { getAgentTypeConfig } from '@/lib/agent-categories';


export function PersonaList() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/ia/personas');
      if (!response.ok) throw new Error('Falha ao carregar agentes.');
      const data = await response.json();
      setPersonas(data);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const openDeleteDialog = (persona: Persona) => {
    setPersonaToDelete(persona);
    setIsDeleteDialogOpen(true);
  };

  const handleDuplicate = async (persona: Persona) => {
    setDuplicatingId(persona.id);
    try {
      const response = await fetch(`/api/v1/ia/personas/${persona.id}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao duplicar agente.');
      }

      const newPersona = await response.json();
      notify.success('Agente Duplicado!', `O agente "${persona.name}" foi duplicado com sucesso.`);
      setPersonas(prev => [newPersona, ...prev]);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!personaToDelete) return;
    try {
      const response = await fetch(`/api/v1/ia/personas/${personaToDelete.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Falha ao excluir agente.');

      notify.success('Agente Excluído!', `O agente "${personaToDelete.name}" foi removido.`);
      setPersonas(personas.filter(p => p.id !== personaToDelete.id));

    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsDeleteDialogOpen(false);
      setPersonaToDelete(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (personas.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
        <Bot className="mx-auto h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold">Nenhum Agente Criado</h3>
        <p>Comece criando seu primeiro agente de IA para automatizar atendimentos.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {personas.map(persona => (
          <Card key={persona.id} className="flex flex-col">
            <CardHeader className="flex flex-row items-start justify-between">
              <CardTitle>{persona.name}</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <Link href={`/agentes-ia/${persona.id}`} passHref>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuItem
                    onSelect={() => handleDuplicate(persona)}
                    disabled={duplicatingId === persona.id}
                  >
                    {duplicatingId === persona.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    {duplicatingId === persona.id ? 'Duplicando...' : 'Duplicar'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => openDeleteDialog(persona)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge className={`${getAgentTypeConfig(persona.agentType).badgeBg} ${getAgentTypeConfig(persona.agentType).badgeColor}`}>
                    {getAgentTypeConfig(persona.agentType).label}
                  </Badge>
                  {persona.useRag ? (
                    <Badge className="bg-green-600 hover:bg-green-700">
                      <FileText className="mr-1 h-3 w-3" />
                      RAG Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <FileText className="mr-1 h-3 w-3" />
                      Prompt Tradicional
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {persona.model}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">
                  {persona.systemPrompt || 'Nenhuma descrição fornecida.'}
                </CardDescription>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/agentes-ia/${persona.id}`} passHref className="w-full">
                <Button variant="outline" className="w-full">
                  Configurar Agente
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agente &quot;{personaToDelete?.name}&quot;? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Sim, Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
