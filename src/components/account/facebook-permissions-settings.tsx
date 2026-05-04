
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { signIn } from 'next-auth/react';
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

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";


import { getUserFacebookPermissions, revokeFacebookPermission, type FacebookPermission } from '@/app/actions/facebook-permissions';


const REQUIRED_PERMISSIONS = [
    { name: 'email', label: 'E-mail', description: 'Acesso ao seu endereço de e-mail.' },
    { name: 'public_profile', label: 'Perfil Público', description: 'Acesso ao seu nome e foto de perfil.' },
    { name: 'business_management', label: 'Gerenciamento Comercial', description: 'Permite gerenciar seu Business Manager.' },
    { name: 'whatsapp_business_management', label: 'Gerenciamento WhatsApp', description: 'Permite configurar contas do WhatsApp Business.' },
    { name: 'whatsapp_business_messaging', label: 'Mensagens WhatsApp', description: 'Permite enviar e receber mensagens.' },
    { name: 'instagram_basic', label: 'Instagram Básico', description: 'Acesso básico ao perfil do Instagram (Necessário para Direct).' },
    { name: 'instagram_manage_messages', label: 'Mensagens Instagram', description: 'Permite enviar e receber DMs do Instagram.' },
    { name: 'pages_show_list', label: 'Listar Páginas', description: 'Permite listar as páginas que você gerencia.' },
    { name: 'pages_manage_metadata', label: 'Metadados de Páginas', description: 'Permite gerenciar metadados das páginas.' },
    { name: 'pages_messaging', label: 'Mensagens de Páginas', description: 'Permite enviar e receber mensagens via Page Inbox.' }
];

export function FacebookPermissionsSettings() {
    const [permissions, setPermissions] = useState<FacebookPermission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRevoking, setIsRevoking] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    // State for re-connect dialog
    const [showReconnectDialog, setShowReconnectDialog] = useState(false);
    const [toggledPermission, setToggledPermission] = useState<string | null>(null);

    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const fetchPermissions = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getUserFacebookPermissions();
            if (result.success) {
                setPermissions(result.permissions);
            } else {
                setError(result.error || 'Falha ao carregar permissões.');
            }
        } catch (err) {
            setError('Erro inesperado ao carregar permissões.');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when opening
    useEffect(() => {
        if (isOpen) {
            fetchPermissions();
        }
    }, [isOpen]);

    const handleToggle = async (permissionName: string, checked: boolean) => {
        if (!checked) {
            // User wants to REVOKE
            setIsRevoking(permissionName);
            try {
                const result = await revokeFacebookPermission(permissionName);
                if (result.success) {
                    notify.success('Permissão Revogada', `A permissão ${permissionName} foi removida.`);
                    // Optimistic update or refetch
                    setPermissions(prev => prev.filter(p => p.permission !== permissionName));
                } else {
                    notify.error('Erro ao Revogar', result.error || 'Falha ao remover permissão.');
                }
            } catch (err) {
                notify.error('Erro', 'Ocorreu um erro ao tentar revogar a permissão.');
            } finally {
                setIsRevoking(null);
            }
        } else {
            // User wants to GRANT (Re-enable)
            // Cannot be done via API, must re-login
            setToggledPermission(permissionName);
            setShowReconnectDialog(true);
        }
    };

    const handleReconnect = () => {
        // Trigger Facebook Login Flow
        signIn('facebook', { callbackUrl: '/account' });
    };

    const isConnected = !error && !loading;

    return (
        <div className="space-y-6">
            <Card>
                <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                    <div className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2">
                            <Image src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" width={20} height={20} alt="FB" />
                            <div>
                                <h3 className="text-lg font-semibold leading-none tracking-tight">Permissões do Facebook</h3>
                                <p className="text-sm text-muted-foreground mt-1">Gerencie as permissões concedidas ao MasterIA.</p>
                            </div>
                        </div>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-9 p-0 hover:bg-muted">
                                {isOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                                <span className="sr-only">Toggle</span>
                            </Button>
                        </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="animate-accordion-down overflow-hidden">
                        <div className="px-6 pb-6 pt-0 space-y-6 border-t pt-6">
                            {loading ? (
                                <div className="flex justify-center p-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : error ? (
                                <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-md">
                                    <AlertCircle className="h-5 w-5" />
                                    <p className="text-sm font-medium">{error}</p>
                                    {error.includes('conectado') && (
                                        <Button variant="link" onClick={() => signIn('facebook')} className="text-destructive underline ml-auto">
                                            Conectar Agora
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {REQUIRED_PERMISSIONS.map((perm) => {
                                        const userPerm = permissions.find(p => p.permission === perm.name);
                                        const isGranted = userPerm?.status === 'granted';
                                        const isLoadingThis = isRevoking === perm.name;

                                        return (
                                            <div key={perm.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-secondary/20 transition-colors gap-3">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-sm">{perm.label}</span>
                                                        {isGranted ?
                                                            <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 text-[10px] px-1.5 py-0">Ativo</Badge> :
                                                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">Inativo</Badge>
                                                        }
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{perm.description} <span className="font-mono text-[10px] opacity-70">({perm.name})</span></p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isLoadingThis ? (
                                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <Switch
                                                            checked={isGranted}
                                                            onCheckedChange={(checked) => handleToggle(perm.name, checked)}
                                                            aria-label={`Alternar permissão ${perm.label}`}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {isConnected && (
                                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-md p-4 text-xs text-blue-800 flex items-start gap-2">
                                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                                    <p>
                                        <strong>Nota de Segurança:</strong> Ao desativar uma permissão, ela é revogada imediatamente nos servidores da Meta.
                                        Para reativá-la, você precisará fazer login novamente e conceder a permissão na tela de consentimento.
                                    </p>
                                </div>
                            )}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </Card>

            <AlertDialog open={showReconnectDialog} onOpenChange={setShowReconnectDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reconectar com Facebook</AlertDialogTitle>
                        <AlertDialogDescription>
                            Para ativar a permissão <strong>{REQUIRED_PERMISSIONS.find(p => p.name === toggledPermission)?.label || toggledPermission}</strong> novamente,
                            é necessário refazer o login com o Facebook e aceitar a solicitação de permissão.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setToggledPermission(null); if (isOpen) fetchPermissions(); }}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReconnect}>Reconectar Agora</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
