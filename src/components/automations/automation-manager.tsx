'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AutomationList } from './automation-list';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, Loader2, Upload } from 'lucide-react';
import { MetaIntegrationPopup } from './meta-integration-popup';
import { useSession } from '@/contexts/session-context';
import { saveFlow } from '@/lib/automations';
import { toast } from 'sonner';

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
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { session } = useSession();
    const router = useRouter();

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                setIsImporting(true);
                const data = JSON.parse(ev.target?.result as string);
                
                if (data._format !== "master-ia-automation-v2") {
                    toast.error("Formato de arquivo inválido. O arquivo não é uma automação exportada válida.");
                    return;
                }

                if (!session?.empresaId) {
                    toast.error("Sessão inválida para importação.");
                    return;
                }

                const importedName = `${data.name} (Importado)`;
                const result = await saveFlow('new', importedName, session.empresaId, data.visualData, data.executionLogic || []);
                
                if (!result.success) {
                    toast.error(result.error || 'Erro ao importar automação no servidor.');
                    return;
                }

                toast.success('Automação importada com sucesso!');
                setRefreshTrigger(prev => prev + 1);
                router.refresh(); // Força atualização do Server Component Cache
            } catch (err) {
                console.error("Erro ao importar automação:", err);
                toast.error('Erro ao ler o arquivo JSON. Verifique se ele não está corrompido.');
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.readAsText(file);
    };

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
                    
                    <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                    />
                    
                    <Button 
                        variant="outline" 
                        onClick={handleImportClick} 
                        className="gap-2"
                        disabled={isImporting}
                    >
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Importar
                    </Button>

                    <Button onClick={() => setEditingFlowId('new')} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Automação
                    </Button>
                </div>
            </div>

            <AutomationList onEdit={setEditingFlowId} refreshTrigger={refreshTrigger} />
        </div>
    );
}
