// src/components/contacts/start-conversation-dialog.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MediaUploader } from '@/components/campaigns/media-uploader';
import type { Template, Contact, Connection, MediaAsset, HeaderType } from '@/lib/types';
import { Loader2, Send, ImageIcon } from 'lucide-react';

const contactFields = [
    { value: 'name', label: 'Nome' },
    { value: 'phone', label: 'Telefone' },
    { value: 'email', label: 'Email' },
];

type VariableMapping = {
    type: 'dynamic' | 'fixed';
    value: string;
};

export function StartConversationDialog({ contact }: { contact: Contact | null }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [connections, setConnections] = React.useState<Connection[]>([]);
    const [templates, setTemplates] = React.useState<Template[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const [selectedConnectionId, setSelectedConnectionId] = React.useState<string>('');
    const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>('');
    const [variableMappings, setVariableMappings] = React.useState<Record<string, VariableMapping>>({});
    const [selectedMedia, setSelectedMedia] = React.useState<MediaAsset | null>(null);

    const { toast } = useToast();
    const notify = React.useMemo(() => createToastNotifier(toast), [toast]);
    const router = useRouter();

    const wabaId = React.useMemo(() => {
        return connections.find(c => c.id === selectedConnectionId)?.wabaId;
    }, [connections, selectedConnectionId]);

    const availableTemplates = React.useMemo(() => {
        if (!wabaId) return [];
        return templates.filter(t => t.wabaId === wabaId && (t.status === 'APPROVED' || t.status === 'APROVADO'));
    }, [templates, wabaId]);
    
    const selectedTemplate = React.useMemo(() => {
        return templates.find(t => t.id === selectedTemplateId);
    }, [templates, selectedTemplateId]);

    const templateParts = React.useMemo(() => {
        if (!selectedTemplate?.body) return [];
        return selectedTemplate.body.split(/(\{\{.*?\}\})/).map((part) => ({
          type: part.match(/(\{\{.*?\}\})/) ? 'variable' : 'text',
          content: part,
          name: part.match(/\{\{(.*?)\}\}/)?.[1] || '',
        }));
    }, [selectedTemplate]);

    const variableNames = React.useMemo(() => 
        templateParts.filter(p => p.type === 'variable').map(p => p.name).filter((v, i, a) => a.indexOf(v) === i)
    , [templateParts]);

    React.useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const fetchInitialData = async () => {
                try {
                    const [connRes, tplRes] = await Promise.all([
                        fetch('/api/v1/connections'),
                        fetch('/api/v1/message-templates'),
                    ]);
                    if (!connRes.ok || !tplRes.ok) throw new Error('Falha ao carregar dados.');
                    
                    const connData = await connRes.json();
                    const activeConnections = connData.filter((c: Connection) => c.isActive);
                    setConnections(activeConnections);
                    
                    const tplData = await tplRes.json();
                    setTemplates(tplData.templates || tplData);

                    if (activeConnections.length > 0) {
                        setSelectedConnectionId(activeConnections[0].id);
                    }
                } catch (error) {
                    notify.error('Erro', (error as Error).message);
                } finally {
                    setLoading(false);
                }
            };
            fetchInitialData();
        } else {
            // Reset state on close
            setSelectedConnectionId('');
            setSelectedTemplateId('');
            setVariableMappings({});
            setSelectedMedia(null);
        }
    }, [isOpen, toast]);
    
    React.useEffect(() => {
        const initialMappings: Record<string, VariableMapping> = {};
        variableNames.forEach(name => {
            initialMappings[name] = { type: 'fixed', value: '' };
        });
        setVariableMappings(initialMappings);
    }, [variableNames]);

    const handleVariableMappingTypeChange = (variable: string, type: 'dynamic' | 'fixed') => {
        setVariableMappings(prev => ({ ...prev, [variable]: { type, value: '' } }));
    };
    
    const handleVariableMappingValueChange = (variable: string, value: string) => {
        setVariableMappings(prev => ({
            ...prev,
            [variable]: {
                type: prev[variable]?.type || 'fixed', // Correctly handles undefined type
                value
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contact) return;
        setIsProcessing(true);

        const requiresMedia = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate?.headerType || 'NONE');
        if (requiresMedia && !selectedMedia) {
             notify.error('Mídia Obrigatória', 'Por favor, anexe uma mídia para este modelo.');
             setIsProcessing(false);
             return;
        }

        try {
            const response = await fetch('/api/v1/conversations/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contactId: contact.id,
                    connectionId: selectedConnectionId,
                    templateId: selectedTemplateId,
                    variableMappings,
                    mediaAssetId: selectedMedia?.id,
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            
            notify.success('Conversa Iniciada!', 'A mensagem foi enviada com sucesso.');
            router.push(`/atendimentos?conversationId=${result.conversationId}`);
            setIsOpen(false);

        } catch (error) {
            notify.error('Erro ao Enviar', (error as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };
    
    const renderPreview = () => {
        if (!selectedTemplate) {
            return <p className="text-sm text-muted-foreground text-center py-4">Selecione um modelo para ver a pré-visualização.</p>;
        }

        const bodyWithVariables = templateParts.map((part, index) => {
            if (part.type === 'variable') {
                const mapping = variableMappings[part.name];
                let value = `{{${part.name}}}`; // Default placeholder
                if (mapping) {
                    if (mapping.type === 'fixed' && mapping.value) {
                        value = mapping.value;
                    } else if (mapping.type === 'dynamic' && mapping.value && contact) {
                        const fieldValue = contact[mapping.value as keyof Contact] as string;
                        value = fieldValue || `[${part.name}]`;
                    }
                }
                return <span key={index} className="font-bold text-primary">{value}</span>;
            }
            return part.content;
        });

        return (
            <div className="space-y-2 p-3 bg-muted rounded-md text-sm h-full flex flex-col">
                 {selectedMedia && (
                    <div className="flex items-center gap-2 p-2 bg-background rounded border mb-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold truncate">{selectedMedia.name}</span>
                    </div>
                 )}
                 <p className="whitespace-pre-wrap flex-1">{bodyWithVariables}</p>
            </div>
        )
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><Send className="mr-2 h-4 w-4"/> Iniciar Conversa</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Iniciar Conversa com {contact?.name}</DialogTitle>
                    <DialogDescription>
                        Selecione a conexão, o modelo e preencha as variáveis para enviar a sua mensagem.
                    </DialogDescription>
                </DialogHeader>
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin"/>
                    </div>
                ) : (
                <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 flex-1 min-h-0 overflow-y-auto pr-4">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="connection-select">Enviar de</Label>
                                <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
                                    <SelectTrigger><SelectValue placeholder="Selecione uma conexão"/></SelectTrigger>
                                    <SelectContent>{connections.map(c => <SelectItem key={c.id} value={c.id}>{c.config_name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="template-select">Usando o Modelo</Label>
                                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                    <SelectTrigger disabled={!wabaId}><SelectValue placeholder="Selecione um modelo"/></SelectTrigger>
                                    <SelectContent>{availableTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            {selectedTemplate && (
                            <>
                                {selectedTemplate.headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.headerType) && (
                                    <div className="space-y-2">
                                        <Label>Anexo de Mídia ({selectedTemplate.headerType})</Label>
                                        <MediaUploader 
                                            mediaType={selectedTemplate.headerType as HeaderType}
                                            onMediaSelect={setSelectedMedia}
                                            selectedMedia={selectedMedia}
                                            connectionId={selectedConnectionId}
                                            onHandleGenerated={() => {}}
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Variáveis da Mensagem</Label>
                                    {variableNames.length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-4 bg-muted rounded-md">Este modelo não possui variáveis.</p>
                                    ) : (
                                        variableNames.map((varName) => (
                                            <div key={varName} className="p-3 border rounded-md">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                                <div className="space-y-2">
                                                    <Label className="font-semibold">{`{{${varName}}}`}</Label>
                                                    <RadioGroup 
                                                        value={variableMappings[varName]?.type || 'fixed'} 
                                                        onValueChange={(type: 'dynamic' | 'fixed') => handleVariableMappingTypeChange(varName, type)}
                                                        className="pt-2"
                                                    >
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="fixed" id={`fixed-${varName}`} />
                                                            <Label htmlFor={`fixed-${varName}`}>Valor Fixo</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <RadioGroupItem value="dynamic" id={`dynamic-${varName}`} />
                                                            <Label htmlFor={`dynamic-${varName}`}>Campo do Contato</Label>
                                                        </div>
                                                    </RadioGroup>
                                                </div>
                                                <div className="mt-1">
                                                    {variableMappings[varName]?.type === 'dynamic' ? (
                                                        <Select value={variableMappings[varName]?.value || ''} onValueChange={(value) => handleVariableMappingValueChange(varName, value)}>
                                                            <SelectTrigger><SelectValue placeholder="Selecione um campo"/></SelectTrigger>
                                                            <SelectContent>
                                                                {contactFields.map(field => <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Input placeholder="Digite o valor fixo" value={variableMappings[varName]?.value || ''} onChange={e => handleVariableMappingValueChange(varName, e.target.value)} />
                                                    )}
                                                </div>
                                            </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                </>
                            )}
                        </div>
                        <div className="space-y-2">
                             <Label>Pré-visualização</Label>
                             {renderPreview()}
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <Button type="button" variant="secondary" disabled={isProcessing} onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isProcessing || !selectedTemplateId}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Enviar Mensagem
                        </Button>
                    </DialogFooter>
                </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
