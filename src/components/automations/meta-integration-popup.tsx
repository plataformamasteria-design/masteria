'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Loader2, CheckCircle2 } from 'lucide-react';
import { useConnections } from '@/hooks/use-connections';
import { WebhookInfoCard } from '@/components/settings/connections/webhook-info-card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getMetaAuthUrl } from '@/app/actions/meta-connect';
import { getMetaPendingAccounts, finishMetaOAuthSetup } from '@/app/actions/meta-graph';
import { toast } from '@/hooks/use-toast';
import { ConnectionDialog } from '@/components/settings/connections/connection-dialog';

export function MetaIntegrationPopup() {
    const {
        connections,
        fetchConnections,
        isEditModalOpen,
        setIsEditModalOpen,
        handleSaveConnection,
    } = useConnections();

    const [wizardOpen, setWizardOpen] = useState(false);
    const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);

    // States do Step 2
    const [pendingConn, setPendingConn] = useState<any>(null);
    const [step2Loading, setStep2Loading] = useState(false);
    const [accountsData, setAccountsData] = useState<{ wabas: any[], adAccounts: any[] } | null>(null);
    const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
    const [selectedWabaId, setSelectedWabaId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (wizardOpen) {
            // Check if there is a pending oauth connection
            const foundPending = connections.find(c => c.connectionType === 'meta_api' && c.wabaId === 'PENDING_OAUTH');
            if (foundPending) {
                setPendingConn(foundPending);
                loadAccounts(foundPending.id);
            } else {
                setPendingConn(null);
            }
        }
    }, [wizardOpen, connections]);

    const loadAccounts = async (connId: string) => {
        setStep2Loading(true);
        const res = await getMetaPendingAccounts(connId);
        if (res.success) {
            setAccountsData(res);
            // Default select
            if (res.wabas && res.wabas.length > 0 && res.wabas[0].phones.length > 0) {
                setSelectedWabaId(res.wabas[0].waba_id);
                setSelectedPhoneId(res.wabas[0].phones[0].id);
            }
        }
        setStep2Loading(false);
    };

    const handleLoginClick = async () => {
        setIsLoadingOAuth(true);
        try {
            // Repassa a rota em que o usuário está para forçar retorno exato
            const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/automacoes';
            const res = await getMetaAuthUrl(currentPath);
            if (res.success && res.url) {
                window.location.href = res.url;
            } else {
                toast({ title: 'Erro', description: res.error || 'Falha ao gerar link', variant: 'destructive' });
                setIsLoadingOAuth(false);
            }
        } catch (e) {
            setIsLoadingOAuth(false);
        }
    };

    const handleFinishSetup = async () => {
        if (!selectedPhoneId || !selectedWabaId || !pendingConn) return;
        setIsSaving(true);
        const res = await finishMetaOAuthSetup(pendingConn.id, { wabaId: selectedWabaId, phoneId: selectedPhoneId });
        if (res.success) {
            toast({ title: 'Ativado!', description: 'Conexão sincronizada perfeitamente.' });
            await fetchConnections();
            setWizardOpen(false); // Fecha ao terminar
        } else {
            toast({ title: 'Erro', description: res.error, variant: 'destructive' });
        }
        setIsSaving(false);
    };

    return (
        <>
            <Button onClick={() => setWizardOpen(true)} className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white shadow-sm border-none">
                <Facebook className="h-4 w-4" />
                Configurar App Meta
            </Button>

            <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Integração Meta / WhatsApp Cloud</DialogTitle>
                        <DialogDescription>
                            Configure a conexão oficial do WhatsApp Business API. Copie a URL de Webhook abaixo para configurar no painel de Webhooks da Meta Developers.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-2">
                        {/* Passo 1: Informações de Webhook para a Meta */}
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
                            <h3 className="text-sm font-semibold mb-3 text-slate-800">1. Configuração de Webhook (Painel da Meta)</h3>
                            <WebhookInfoCard />
                            <div className="mt-3 text-xs text-muted-foreground p-3 bg-blue-50 rounded-md border border-blue-100">
                                <p><strong className="text-blue-900">Token de Verificação:</strong> <code className="bg-white px-2 py-0.5 rounded text-blue-700">masteria_secure_token_2025</code></p>
                                <p className="mt-1">Insira este Token de Verificação e a URL copiável acima nos campos de Webhook do WhatsApp do seu App no Meta for Developers.</p>
                            </div>
                        </div>

                        {/* Passo 2 Dinâmico: Escolhendo o Cadastro ou Exibindo Sucesso Parcial */}
                        {!pendingConn ? (
                            <div className="space-y-3 pb-2">
                                <h3 className="text-sm font-semibold text-slate-800">2. Conectar Conta (MasterIA)</h3>
                                <p className="text-sm text-slate-500 mb-2">Após copiar o Webhook para o painel de Desenvolvedor, conecte sua conta com 1 clique.</p>
                                <Button
                                    className="w-full shadow-sm bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                                    onClick={handleLoginClick}
                                    disabled={isLoadingOAuth}
                                >
                                    {isLoadingOAuth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Facebook className="mr-2 h-4 w-4" />}
                                    Entrar com Facebook
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3 pb-2 animate-in fade-in zoom-in duration-300">
                                <h3 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Conta Conectada
                                </h3>
                                <p className="text-sm text-slate-500 mb-2">Suas permissões foram autorizadas. Selecione o Número do WhatsApp associado:</p>

                                {step2Loading ? (
                                    <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-blue-500" /></div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <label className="text-xs font-semibold text-slate-700 mb-1 block">Número do WhatsApp (WABA)</label>
                                            <select
                                                className="w-full border rounded-md p-2 text-sm bg-white"
                                                value={`${selectedWabaId}:${selectedPhoneId}`}
                                                onChange={(e) => {
                                                    const [waba, phone] = e.target.value.split(':');
                                                    setSelectedWabaId(waba);
                                                    setSelectedPhoneId(phone);
                                                }}
                                            >
                                                {accountsData?.wabas.map(waba => (
                                                    <optgroup key={waba.waba_id} label={`WABA: ${waba.name} (${waba.business_name})`}>
                                                        {waba.phones.map((phone: any) => (
                                                            <option key={phone.id} value={`${waba.waba_id}:${phone.id}`}>
                                                                {phone.display_phone_number} ({phone.verified_name})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                                {accountsData?.wabas.length === 0 && <option disabled>Nenhum WhatsApp Encontrado</option>}
                                            </select>
                                        </div>

                                        <Button
                                            className="w-full shadow-sm"
                                            onClick={handleFinishSetup}
                                            disabled={isSaving || !selectedPhoneId}
                                        >
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sincronizar Oficialmente'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reusamos o ConnectionDialog oficial da Settings nativamente */}
            {isEditModalOpen && (
                <ConnectionDialog
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    editingConnection={null}
                    onSave={async (formData) => {
                        await handleSaveConnection(formData);
                        setIsEditModalOpen(false); // Fecha o form após salvar
                    }}
                />
            )}
        </>
    );
}
