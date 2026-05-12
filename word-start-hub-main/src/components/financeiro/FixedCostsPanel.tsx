import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Plus, Trash2, Building, Receipt, Users, Monitor, MoreHorizontal, Loader2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface FixedCost {
    id: string;
    name: string;
    amount: number;
    category: string;
    recurrence: string;
    due_day?: number;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
    payroll: Users,
    software: Monitor,
    tax: Receipt,
    office: Building,
    ads_fee: FileText,
    other: MoreHorizontal,
};

const CATEGORY_LABELS: Record<string, string> = {
    payroll: "Folha de Pagamento",
    software: "Software & Cloud",
    tax: "Impostos",
    office: "Infraestrutura Física",
    ads_fee: "Taxas sobre Ads",
    other: "Outros",
};

export function FixedCostsPanel() {
    const { currentOrganization } = useOrganization();
    const { toast } = useToast();
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        amount: "",
        category: "software",
        recurrence: "monthly",
        due_day: "5",
    });

    useEffect(() => {
        if (currentOrganization?.id) {
            fetchCosts();
        }
    }, [currentOrganization?.id]);

    const fetchCosts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('platform_fixed_costs')
                .select('*')
                .eq('organization_id', currentOrganization?.id)
                .order('amount', { ascending: false });

            if (error) throw error;
            setCosts(data || []);
        } catch (error) {
            console.error("Error fetching fixed costs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.amount) {
            toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase.from('platform_fixed_costs').insert({
                organization_id: currentOrganization?.id,
                name: formData.name,
                amount: parseFloat(formData.amount.replace(',', '.')),
                category: formData.category,
                recurrence: formData.recurrence,
                due_day: parseInt(formData.due_day) || null
            });
            if (error) throw error;
            toast({ title: "Custo Fixo Registrado!", description: "Custo adicionado e agora abaterá no Lucro Mensal." });
            setIsOpen(false);
            setFormData({ name: "", amount: "", category: "software", recurrence: "monthly", due_day: "5" });
            fetchCosts();
        } catch (error: any) {
            toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase.from('platform_fixed_costs').delete().eq('id', id);
            if (error) throw error;
            toast({ title: "Custo Removido" });
            fetchCosts();
        } catch (error: any) {
            toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
        }
    };

    const totalMonthly = costs.filter(c => c.recurrence === 'monthly').reduce((acc, c) => acc + Number(c.amount), 0);

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                        <Building className="h-5 w-5 text-indigo-500" />
                        Custos Operacionais Fixos
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">Valores recorrentes da operação para cálculo globalizado do Lucro Líquido</p>
                </div>
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="h-4 w-4" /> Adicionar Custo
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Custo Fixo</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Nome / Descrição</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Assinatura ChatGPT" />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor Mensal (R$)</Label>
                                <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Categoria</Label>
                                    <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.keys(CATEGORY_LABELS).map(k => (
                                                <SelectItem key={k} value={k}>{CATEGORY_LABELS[k]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Dia de Vencimento</Label>
                                    <Input type="number" min="1" max="31" value={formData.due_day} onChange={e => setFormData({ ...formData, due_day: e.target.value })} />
                                </div>
                            </div>
                            <Button className="w-full mt-4" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Salvar Custo Fixo
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-muted/50 rounded-lg border border-border/50 col-span-1 md:col-span-4 flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase text-muted-foreground mr-4">Projeção Mensal Operacional</span>
                    <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                        {totalMonthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : costs.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground bg-muted/10">Nenhum custo físico registrado.</div>
                ) : (
                    costs.map(cost => {
                        const Icon = CATEGORY_ICONS[cost.category] || FileText;
                        return (
                            <div key={cost.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-md text-indigo-600 dark:text-indigo-400">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">{cost.name}</h4>
                                        <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cost.category]} • Vence dia {cost.due_day}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-foreground">
                                        {Number(cost.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-50 hover:opacity-100" onClick={() => handleDelete(cost.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
