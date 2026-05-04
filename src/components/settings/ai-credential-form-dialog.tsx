
// src/components/settings/ai-credential-form-dialog.tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useState, useEffect, useMemo } from 'react';
import type { AiCredential } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface AiCredentialFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    credentialToEdit?: AiCredential | null;
    onSaveSuccess: (credential: AiCredential) => void;
}

type Provider = 'GEMINI';

const CredentialInputs = ({ provider, credential }: { provider: Provider | null, credential: AiCredential | null }): JSX.Element | null => {
    if (!provider) return null;
    
    const config = {
        credentials: [{ name: 'apiKey', label: 'Chave de API (Google Gemini)', type: 'password' }]
    };

    return (
        <>
            {config.credentials.map(field => (
                <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{field.label}</Label>
                    <Input 
                      id={field.name} 
                      name={field.name} 
                      type={field.type} 
                      required={!credential}
                      placeholder={credential ? 'Deixe em branco para manter a atual' : ''}
                      defaultValue={''}
                    />
                </div>
            ))}
        </>
    );
}

export function AiCredentialFormDialog({ isOpen, onOpenChange, credentialToEdit, onSaveSuccess }: AiCredentialFormDialogProps) {
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

    useEffect(() => {
        if (isOpen && credentialToEdit) {
            setSelectedProvider(credentialToEdit.provider as Provider);
        } else if (!isOpen) {
            setSelectedProvider(null);
        }
    }, [isOpen, credentialToEdit]);

    const handleSave = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setIsProcessing(true);
        const formData = new FormData(event.currentTarget);
        
        const isEditing = !!credentialToEdit;
        const provider = isEditing ? credentialToEdit.provider : selectedProvider;

        if (!provider) {
             notify.error('Erro', 'O provedor é obrigatório.');
             setIsProcessing(false);
             return;
        }

        const payload: Partial<AiCredential> = {
            name: formData.get('name') as string,
            provider,
        };

        const apiKey = formData.get('apiKey') as string;
        if (apiKey) {
            payload.apiKey = apiKey;
        }

        if (!isEditing && !apiKey) {
            notify.error('Erro', 'A chave de API é obrigatória ao criar uma nova credencial.');
            setIsProcessing(false);
            return;
        }

        const url = isEditing ? `/api/v1/ia/credentials/${credentialToEdit.id}` : '/api/v1/ia/credentials';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Falha ao salvar a credencial.');
            }
            notify.success(`Credencial ${isEditing ? 'Atualizada' : 'Salva'}!`);
            onSaveSuccess(result);
            onOpenChange(false);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{credentialToEdit ? 'Editar Credencial' : 'Adicionar Credencial de IA'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave}>
                    <div className="space-y-4 py-4">
                         <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input id="name" name="name" placeholder="Ex: Cliente A - GPT4o" defaultValue={credentialToEdit?.name} required/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="provider">Provedor</Label>
                            <Select 
                                name="provider" 
                                value={selectedProvider || credentialToEdit?.provider}
                                onValueChange={(v) => setSelectedProvider(v as Provider)} 
                                disabled={!!credentialToEdit}
                            >
                                <SelectTrigger id="provider"><SelectValue placeholder="Selecione um provedor" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GEMINI">Google Gemini</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <CredentialInputs provider={(credentialToEdit?.provider as Provider) || selectedProvider} credential={credentialToEdit || null} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" disabled={isProcessing} onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
