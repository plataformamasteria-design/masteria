import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppCloudConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: () => void;
}

export function WhatsAppCloudConfigDialog({
    open,
    onOpenChange,
    onSaved,
}: WhatsAppCloudConfigDialogProps) {
    const { currentOrganization, refreshOrganizations } = useOrganization();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);

    const settings = (currentOrganization?.settings || {}) as Record<string, unknown>;
    const [wabaId, setWabaId] = useState((settings.whatsapp_cloud_waba_id as string) || '');
    const [phoneNumberId, setPhoneNumberId] = useState((settings.whatsapp_cloud_phone_number_id as string) || '');
    const [accessToken, setAccessToken] = useState((settings.whatsapp_cloud_access_token as string) || '');

    // Sincronizar quando dialog abre com dados atuais
    React.useEffect(() => {
        if (open && currentOrganization) {
            const s = (currentOrganization.settings || {}) as Record<string, unknown>;
            setWabaId((s.whatsapp_cloud_waba_id as string) || '');
            setPhoneNumberId((s.whatsapp_cloud_phone_number_id as string) || '');
            setAccessToken((s.whatsapp_cloud_access_token as string) || '');
        }
    }, [open, currentOrganization]);

    const handleSave = async () => {
        if (!currentOrganization?.id) return;

        if (!wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
            toast({
                title: 'Campos obrigatórios',
                description: 'Preencha todos os campos antes de salvar.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const newSettings = {
                ...settings,
                whatsapp_cloud_waba_id: wabaId.trim(),
                whatsapp_cloud_phone_number_id: phoneNumberId.trim(),
                whatsapp_cloud_access_token: accessToken.trim(),
            };

            const { error } = await (supabase as any)
                .from('organizations')
                .update({ settings: newSettings })
                .eq('id', currentOrganization.id);

            if (error) throw error;

            await refreshOrganizations();
            toast({
                title: 'Configuração salva',
                description: 'WhatsApp Cloud API configurado com sucesso.',
            });
            onSaved?.();
            onOpenChange(false);
        } catch (e: any) {
            toast({
                title: 'Erro ao salvar',
                description: e.message,
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!currentOrganization?.id) return;
        setSaving(true);
        try {
            const newSettings = { ...settings };
            delete newSettings.whatsapp_cloud_waba_id;
            delete newSettings.whatsapp_cloud_phone_number_id;
            delete newSettings.whatsapp_cloud_access_token;

            const { error } = await (supabase as any)
                .from('organizations')
                .update({ settings: newSettings })
                .eq('id', currentOrganization.id);

            if (error) throw error;

            await refreshOrganizations();
            setWabaId('');
            setPhoneNumberId('');
            setAccessToken('');
            toast({ title: 'Desconectado', description: 'WhatsApp Cloud API desconectado.' });
            onSaved?.();
        } catch (e: any) {
            toast({ title: 'Erro', description: e.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const isConfigured = !!(settings.whatsapp_cloud_waba_id && settings.whatsapp_cloud_phone_number_id);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-green-600">
                            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                        </div>
                        WhatsApp Cloud API
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Configure a integração com a WhatsApp Business Cloud API do Meta.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {isConfigured && (
                        <div className="flex items-center gap-2 p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                WhatsApp Cloud API configurado
                            </span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">WABA ID (WhatsApp Business Account ID)</Label>
                        <Input
                            value={wabaId}
                            onChange={(e) => setWabaId(e.target.value)}
                            placeholder="Ex: 123456789012345"
                            className="text-sm font-mono"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Phone Number ID</Label>
                        <Input
                            value={phoneNumberId}
                            onChange={(e) => setPhoneNumberId(e.target.value)}
                            placeholder="Ex: 109876543210987"
                            className="text-sm font-mono"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Access Token (permanente)</Label>
                        <Input
                            type="password"
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            placeholder="Token de acesso permanente"
                            className="text-sm font-mono"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-gradient-to-r from-teal-500 to-green-600 hover:from-teal-600 hover:to-green-700 text-white"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {isConfigured ? 'Atualizar' : 'Salvar Configuração'}
                        </Button>

                        {isConfigured && (
                            <Button
                                variant="outline"
                                onClick={handleDisconnect}
                                disabled={saving}
                                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                            >
                                Desconectar
                            </Button>
                        )}
                    </div>

                    <div className="border-t border-border pt-3 mt-3">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            <strong>Como obter os IDs:</strong> Acesse o{' '}
                            <a
                                href="https://business.facebook.com/settings/whatsapp-business-accounts"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline inline-flex items-center gap-0.5"
                            >
                                Meta Business Manager
                                <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            {' '}→ WhatsApp Accounts → Selecione sua conta → copie o WABA ID e Phone Number ID.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
