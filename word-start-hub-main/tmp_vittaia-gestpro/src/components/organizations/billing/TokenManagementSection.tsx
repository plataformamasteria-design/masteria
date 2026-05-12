import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Zap, Edit, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TokenManagementSection() {
    const [orgs, setOrgs] = useState<any[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingBalance, setEditingBalance] = useState<any>(null);
    const [newTotal, setNewTotal] = useState("");
    const [newUsed, setNewUsed] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const [orgsRes, balancesRes] = await Promise.all([
            (supabase as any).from("organizations").select("id, name, slug, lifetime").order("name"),
            (supabase as any).from("organization_token_balances").select("*"),
        ]);
        setOrgs(orgsRes.data || []);
        setBalances(balancesRes.data || []);
        setIsLoading(false);
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSaveBalance = async () => {
        if (!editingBalance) return;
        setIsSaving(true);
        const { error } = await (supabase as any)
            .from("organization_token_balances")
            .update({
                total_tokens: parseInt(newTotal, 10),
                used_tokens: parseInt(newUsed, 10),
                updated_at: new Date().toISOString(),
            })
            .eq("id", editingBalance.id);

        if (error) {
            toast.error("Erro ao atualizar saldo");
        } else {
            toast.success("Saldo atualizado");
            setEditingBalance(null);
            await fetchData();
        }
        setIsSaving(false);
    };

    if (isLoading) return <Skeleton className="h-64" />;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-violet-500" />
                        Gestão de Tokens (Todas as Organizações)
                    </CardTitle>
                    <CardDescription>Visualize e ajuste manualmente o saldo de tokens de cada organização</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Organização</TableHead>
                                    <TableHead>Provider</TableHead>
                                    <TableHead>Total Contratado</TableHead>
                                    <TableHead>Usado</TableHead>
                                    <TableHead>Saldo Atual</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balances.map((b) => {
                                    const org = orgs.find(o => o.id === b.organization_id);
                                    const isLifetime = !!org?.lifetime;
                                    const remaining = b.total_tokens - b.used_tokens;
                                    return (
                                        <TableRow key={b.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{org?.name || "???"}</span>
                                                        <span className="text-[10px] text-muted-foreground">{org?.slug}</span>
                                                    </div>
                                                    {isLifetime && (
                                                        <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1 text-[10px]">
                                                            <Crown className="h-3 w-3" /> Vitalício
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={b.provider === 'openai' ? 'text-emerald-600' : 'text-violet-600'}>
                                                    {b.provider === 'openai' ? 'ChatGPT' : 'Gemini'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {isLifetime ? <span className="text-amber-600 font-bold">∞</span> : b.total_tokens.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{b.used_tokens.toLocaleString()}</TableCell>
                                            <TableCell>
                                                {isLifetime ? (
                                                    <Badge variant="outline" className="font-mono text-amber-600 border-amber-400">∞ Ilimitado</Badge>
                                                ) : (
                                                    <Badge variant={remaining <= 0 ? "destructive" : "secondary"} className="font-mono">
                                                        {remaining.toLocaleString()}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                    setEditingBalance(b);
                                                    setNewTotal(String(b.total_tokens));
                                                    setNewUsed(String(b.used_tokens));
                                                }}>
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!editingBalance} onOpenChange={(o) => { if (!o) setEditingBalance(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajustar Saldo de Tokens</DialogTitle>
                        <DialogDescription>
                            {orgs.find(o => o.id === editingBalance?.organization_id)?.name} - {editingBalance?.provider}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Total de Tokens Comprados</Label>
                            <Input type="number" value={newTotal} onChange={e => setNewTotal(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Tokens Já Utilizados</Label>
                            <Input type="number" value={newUsed} onChange={e => setNewUsed(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingBalance(null)}>Cancelar</Button>
                        <Button onClick={handleSaveBalance} disabled={isSaving}>
                            {isSaving ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
