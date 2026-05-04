'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Key, Wallet, Building2, Save } from 'lucide-react';
import { MasterOrg, getCompanyDetails, updateCompanyCredentials, updateCompanyFinancials } from '@/app/actions/superadmin-actions';
import { toast } from 'sonner';

interface OrganizationDetailsDrawerProps {
    org: MasterOrg | null;
    open: boolean;
    onClose: () => void;
}

export function OrganizationDetailsDrawer({ org, open, onClose }: OrganizationDetailsDrawerProps) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Credentials State
    const [credentials, setCredentials] = useState({
        openaiApiKey: '',
        geminiApiKey: '',
        elevenlabsApiKey: ''
    });

    // Financials State
    const [financials, setFinancials] = useState({
        monthlyFee: 0,
        implementationFee: 0,
        fixedCosts: 0,
        variableCosts: 0,
        paymentDay: 10
    });

    useEffect(() => {
        if (open && org) {
            fetchDetails();
        }
    }, [open, org]);

    const fetchDetails = async () => {
        if (!org) return;
        setLoading(true);
        const res = await getCompanyDetails(org.id);
        if (res.success && res.data) {
            if (res.data.credentials) {
                setCredentials({
                    openaiApiKey: res.data.credentials.openaiApiKey || '',
                    geminiApiKey: res.data.credentials.geminiApiKey || '',
                    elevenlabsApiKey: res.data.credentials.elevenlabsApiKey || '',
                });
            } else {
                setCredentials({ openaiApiKey: '', geminiApiKey: '', elevenlabsApiKey: '' });
            }

            if (res.data.financials) {
                setFinancials({
                    monthlyFee: Number(res.data.financials.monthlyFee) || 0,
                    implementationFee: Number(res.data.financials.implementationFee) || 0,
                    fixedCosts: Number(res.data.financials.fixedCosts) || 0,
                    variableCosts: Number(res.data.financials.variableCosts) || 0,
                    paymentDay: res.data.financials.paymentDay || 10
                });
            } else {
                setFinancials({ monthlyFee: 0, implementationFee: 0, fixedCosts: 0, variableCosts: 0, paymentDay: 10 });
            }
        }
        setLoading(false);
    };

    const handleSaveCredentials = async () => {
        if (!org) return;
        setSaving(true);
        const res = await updateCompanyCredentials(org.id, credentials);
        if (res.success) {
            toast.success('Credenciais atualizadas com sucesso!');
        } else {
            toast.error('Erro ao salvar credenciais: ' + res.error);
        }
        setSaving(false);
    };

    const handleSaveFinancials = async () => {
        if (!org) return;
        setSaving(true);
        const res = await updateCompanyFinancials(org.id, financials);
        if (res.success) {
            toast.success('Financeiro atualizado com sucesso!');
        } else {
            toast.error('Erro ao salvar financeiro: ' + res.error);
        }
        setSaving(false);
    };

    const estimatedProfit = financials.monthlyFee - financials.fixedCosts - financials.variableCosts;

    if (!org) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-2xl bg-background border-border shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {org.name}
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie configurações avançadas, chaves de inteligência artificial e perfil financeiro deste tenant.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Tabs defaultValue="credentials" className="w-full">
                        <div className="px-6 pt-4">
                            <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/30">
                                <TabsTrigger value="credentials" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs font-bold gap-2">
                                    <Key className="h-3.5 w-3.5" />
                                    Credenciais de IA
                                </TabsTrigger>
                                <TabsTrigger value="financials" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 text-xs font-bold gap-2">
                                    <Wallet className="h-3.5 w-3.5" />
                                    Perfil Financeiro
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* TAB CREDENCIAIS */}
                        <TabsContent value="credentials" className="p-6 pt-4 space-y-6 m-0">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">OpenAI API Key</Label>
                                    <Input 
                                        type="password" 
                                        placeholder="sk-..." 
                                        value={credentials.openaiApiKey}
                                        onChange={e => setCredentials({...credentials, openaiApiKey: e.target.value})}
                                        className="font-mono text-sm bg-muted/10"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Deixe em branco para usar a chave global.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Google Gemini API Key</Label>
                                    <Input 
                                        type="password" 
                                        placeholder="AIza..." 
                                        value={credentials.geminiApiKey}
                                        onChange={e => setCredentials({...credentials, geminiApiKey: e.target.value})}
                                        className="font-mono text-sm bg-muted/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">ElevenLabs API Key</Label>
                                    <Input 
                                        type="password" 
                                        placeholder="Chave de voz..." 
                                        value={credentials.elevenlabsApiKey}
                                        onChange={e => setCredentials({...credentials, elevenlabsApiKey: e.target.value})}
                                        className="font-mono text-sm bg-muted/10"
                                    />
                                </div>
                            </div>
                            <Button 
                                onClick={handleSaveCredentials} 
                                disabled={saving}
                                className="w-full gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Salvar Credenciais
                            </Button>
                        </TabsContent>

                        {/* TAB FINANCEIRO */}
                        <TabsContent value="financials" className="p-6 pt-4 space-y-6 m-0">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Mensalidade (R$)</Label>
                                    <Input 
                                        type="number" 
                                        value={financials.monthlyFee}
                                        onChange={e => setFinancials({...financials, monthlyFee: Number(e.target.value)})}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Taxa de Setup (R$)</Label>
                                    <Input 
                                        type="number" 
                                        value={financials.implementationFee}
                                        onChange={e => setFinancials({...financials, implementationFee: Number(e.target.value)})}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Custos Fixos (R$)</Label>
                                    <Input 
                                        type="number" 
                                        value={financials.fixedCosts}
                                        onChange={e => setFinancials({...financials, fixedCosts: Number(e.target.value)})}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Custos Variáveis (R$)</Label>
                                    <Input 
                                        type="number" 
                                        value={financials.variableCosts}
                                        onChange={e => setFinancials({...financials, variableCosts: Number(e.target.value)})}
                                        className="font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5 col-span-2">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground">Dia de Pagamento</Label>
                                    <Input 
                                        type="number" 
                                        min={1} max={31}
                                        value={financials.paymentDay}
                                        onChange={e => setFinancials({...financials, paymentDay: Number(e.target.value)})}
                                        className="font-mono"
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-emerald-600/80 tracking-wider">Lucro Mensal Estimado</span>
                                    <span className="text-2xl font-black text-emerald-500">
                                        R$ {estimatedProfit.toFixed(2)}
                                    </span>
                                </div>
                                <Wallet className="h-8 w-8 text-emerald-500/30" />
                            </div>

                            <Button 
                                onClick={handleSaveFinancials} 
                                disabled={saving}
                                className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Salvar Financeiro
                            </Button>
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>
        </Dialog>
    );
}
