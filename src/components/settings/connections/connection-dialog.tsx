
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Connection } from './types';

interface ConnectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingConnection: Connection | null;
    onSave: (formData: FormData) => Promise<void>;
}

export function ConnectionDialog({ open, onOpenChange, editingConnection, onSave }: ConnectionDialogProps) {
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        await onSave(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-md mx-auto">
                <DialogHeader>
                    <DialogTitle>
                        {editingConnection?.id ? 'Editar Conexão' : 'Adicionar Nova Conexão API'}
                    </DialogTitle>
                    <DialogDescription>
                        Insira os detalhes da sua conexão com a API da Meta.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="configName">Nome da Conexão</Label>
                            <Input id="configName" name="configName" placeholder="Ex: Minha Empresa Principal" defaultValue={editingConnection?.config_name || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="connectionType">Tipo de Conexão</Label>
                            <Select name="connectionType" defaultValue={editingConnection?.connectionType || 'meta_api'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="meta_api">WhatsApp Business API</SelectItem>
                                    <SelectItem value="instagram">Instagram Graph API</SelectItem>
                                    <SelectItem value="instagram_direct">Instagram Direct API</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="wabaId">ID da Conta do WhatsApp Business (WABA ID)</Label>
                            <Input id="wabaId" name="wabaId" placeholder="Seu WABA ID" defaultValue={editingConnection?.wabaId || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumberId">ID do Número de Telefone</Label>
                            <Input id="phoneNumberId" name="phoneNumberId" placeholder="Seu ID do número de telefone" defaultValue={editingConnection?.phoneNumberId || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appId">ID do Aplicativo (App ID)</Label>
                            <Input id="appId" name="appId" placeholder="Seu App ID da Meta" defaultValue={editingConnection?.appId || ''} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accessToken">Token de Acesso Permanente</Label>
                            <Input id="accessToken" name="accessToken" type="password" placeholder={editingConnection ? 'Deixe em branco para não alterar' : 'Seu token de acesso'} defaultValue="" required={!editingConnection} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="appSecret">Segredo do Aplicativo (App Secret)</Label>
                            <Input id="appSecret" name="appSecret" type="password" placeholder={editingConnection ? 'Deixe em branco para não alterar' : 'Seu App Secret para validação'} defaultValue="" required={!editingConnection} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Salvar Conexão</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
