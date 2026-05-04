// src/app/(main)/ia/[personaId]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { PersonaEditor } from '@/components/ia/persona-editor';
import { RagSectionsManager } from '@/components/ia/rag-sections-manager';
import type { Persona } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dynamic from 'next/dynamic';

// Lazy load heavy chart + AI chat components (only shown when user clicks the tab)
const PersonaMetrics = dynamic(
  () => import('@/components/ia/persona-metrics').then(mod => ({ default: mod.PersonaMetrics })),
  { ssr: false, loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> }
);
const AgentTestChat = dynamic(
  () => import('@/components/ia/agent-test-chat').then(mod => ({ default: mod.AgentTestChat })),
  { ssr: false, loading: () => <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> }
);

export default function EditPersonaPage({ params }: { params: Promise<{ personaId: string }> }) {
  const { personaId } = use(params);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toast } = useToast();

  const fetchPersona = async () => {
    setLoading(true);
    try {
      // Adicionando timestamp para evitar cache do navegador/proxy de forma agressiva
      const response = await fetch(`/api/v1/ia/personas/${personaId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

      if (!response.ok) {
        if (response.status === 404) notFound();
        throw new Error('Falha ao carregar os dados do agente.');
      }
      const data = await response.json();
      console.log('[EditPersonaPage] Dados carregados:', { id: data.id, isTriggerActive: data.isTriggerActive });
      setPersona(data);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro', description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!personaId) return;
    fetchPersona();
  }, [personaId, refreshTrigger, toast]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!persona) {
    // A função notFound() será chamada dentro do useEffect se a resposta for 404.
    // Este é um fallback caso algo inesperado ocorra.
    return <div>Agente não encontrado.</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Editar Agente: ${persona.name}`}
        description="Ajuste o comportamento e o conhecimento do seu assistente virtual."
      >
        <Link href="/agentes-ia" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Agentes
          </Button>
        </Link>
      </PageHeader>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-[800px]">
          <TabsTrigger value="config">Configurações</TabsTrigger>
          <TabsTrigger value="sections">Seções RAG</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="test">Testar</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-6">
          <PersonaEditor
            persona={persona}
            onSaveSuccess={(updatedAgent) => {
              // Atualiza o estado local diretamente com os dados salvos
              if (updatedAgent) {
                setPersona(updatedAgent);
              } else {
                // Fallback se não receber o agente atualizado (compatibilidade)
                setRefreshTrigger(prev => prev + 1);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="sections" className="space-y-6 mt-6">
          <RagSectionsManager personaId={personaId} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-6">
          <PersonaMetrics personaId={personaId} />
        </TabsContent>

        <TabsContent value="test" className="mt-6">
          <div className="h-[calc(100vh-300px)] min-h-[600px]">
            <AgentTestChat personaId={personaId} personaName={persona.name} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
