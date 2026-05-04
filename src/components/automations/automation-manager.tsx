'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AutomationList } from './automation-list';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, Loader2 } from 'lucide-react';
import { MetaIntegrationPopup } from './meta-integration-popup';

// Lazy-load do editor V4 para evitar conflitos de bundle
const FlowEditorV4 = dynamic(
    () => import('./editor-v4/FlowEditorV4').then(mod => ({ default: mod.FlowEditorV4 })),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center bg-zinc-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                        <Loader2 className="h-7 w-7 text-indigo-500 animate-spin" />
                    </div>
                    <p className="text-zinc-400 font-medium tracking-wide text-xs">Carregando editor...</p>
                </div>
            </div>
        ),
    }
);

import { EditorErrorBoundary } from './EditorErrorBoundary';

export function AutomationManager() {
    const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

    if (editingFlowId) {
        return (
            // Editor V4: ocupa tela inteira, tem seu próprio toolbar interno
            <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50">
                <EditorErrorBoundary>
                    <FlowEditorV4
                        flowId={editingFlowId}
                        onSave={(newId) => setEditingFlowId(newId)}
                        onClose={() => setEditingFlowId(null)}
                    />
                </EditorErrorBoundary>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Automações</h2>
                    <p className="text-muted-foreground">
                        Crie e gerencie fluxos inteligentes para automatizar seu atendimento.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <MetaIntegrationPopup />
                    <Button onClick={() => setEditingFlowId('new')} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Automação
                    </Button>
                </div>
            </div>

            <AutomationList onEdit={setEditingFlowId} />
        </div>
    );
}
