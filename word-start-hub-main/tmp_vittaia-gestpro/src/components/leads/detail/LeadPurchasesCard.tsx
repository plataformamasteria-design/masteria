import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Trash2, Edit2 } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

export function LeadPurchasesCard({ chatId, onRefresh }: { chatId: string, onRefresh?: () => void }) {
    const { toast } = useToast();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [productName, setProductName] = useState("");
    const [duration, setDuration] = useState("");
    const [purchaseDate, setPurchaseDate] = useState("");
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
    const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);

    const fetchTransactions = async () => {
        if (!chatId) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTransactions(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [chatId]);

    const handleAddTransaction = async () => {
        try {
            const { error } = await supabase
                .from('transactions')
                .insert({
                    chat_id: chatId,
                    amount: parseFloat(amount),
                    description: description,
                    product_name: productName,
                    duration: duration,
                    purchase_date: purchaseDate || null,
                });

            if (error) throw error;

            toast({ title: "Sucesso", description: "Compra registrada com sucesso" });

            setAmount("");
            setDescription("");
            setProductName("");
            setDuration("");
            setPurchaseDate("");
            fetchTransactions();
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error adding transaction:', error);
            toast({ title: "Erro", description: "Erro ao registrar compra", variant: "destructive" });
        }
    };

    const handleEditTransaction = async () => {
        if (!editingTransaction) return;

        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    amount: parseFloat(amount),
                    description: description,
                    product_name: productName,
                    duration: duration,
                    purchase_date: purchaseDate || null,
                })
                .eq('id', editingTransaction.id);

            if (error) throw error;

            toast({ title: "Sucesso", description: "Compra atualizada com sucesso" });

            setAmount("");
            setDescription("");
            setProductName("");
            setDuration("");
            setPurchaseDate("");
            setEditingTransaction(null);
            fetchTransactions();
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error editing transaction:', error);
            toast({ title: "Erro", description: "Erro ao editar", variant: "destructive" });
        }
    };

    const handleDeleteTransaction = async () => {
        if (!deletingTransaction) return;

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', deletingTransaction.id);

            if (error) throw error;

            toast({ title: "Sucesso", description: "Excluída com sucesso" });
            setDeletingTransaction(null);
            fetchTransactions();
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error deleting:', error);
            toast({ title: "Erro", description: "Erro ao excluir", variant: "destructive" });
        }
    };

    return (
        <>
            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-green-600">
                    <DollarSign className="h-5 w-5" />
                    Registro de Compras
                </h3>

                <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="product" className="text-xs">Produto</Label>
                            <Input id="product" type="text" placeholder="Nome" value={productName} onChange={(e) => setProductName(e.target.value)} className="h-9" />
                        </div>
                        <div>
                            <Label htmlFor="duration" className="text-xs">Duração</Label>
                            <Input id="duration" type="text" placeholder="Ex: 6 meses" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9" />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="description" className="text-xs">Descrição</Label>
                        <Textarea id="description" placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="purchase-date" className="text-xs">Data da Compra</Label>
                            <Input id="purchase-date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="h-9" />
                        </div>
                        <div>
                            <Label htmlFor="amount" className="text-xs">Valor (R$)</Label>
                            <Input id="amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" />
                        </div>
                    </div>
                    <Button onClick={editingTransaction ? handleEditTransaction : handleAddTransaction} className="w-full" disabled={!amount}>
                        {editingTransaction ? 'Atualizar Compra' : 'Adicionar Compra'}
                    </Button>
                    {editingTransaction && (
                        <Button variant="outline" onClick={() => { setEditingTransaction(null); setAmount(""); setDescription(""); setProductName(""); setDuration(""); setPurchaseDate(""); }} className="w-full">
                            Cancelar Edição
                        </Button>
                    )}
                </div>

                {transactions.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Histórico de Compras</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {transactions.map((t) => (
                                <div key={t.id} className="p-3 bg-background/50 rounded-lg">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 space-y-1">
                                            {t.product_name && <p className="font-medium">🛒 {t.product_name}</p>}
                                            {t.duration && <p className="text-xs text-muted-foreground">Duração: {t.duration}</p>}
                                            {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                                            <p className="text-sm font-semibold text-green-600">R$ {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-xs text-muted-foreground">{t.purchase_date ? new Date(t.purchase_date).toLocaleDateString('pt-BR') : new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => {
                                                setEditingTransaction(t);
                                                setAmount(t.amount.toString());
                                                setDescription(t.description || "");
                                                setProductName(t.product_name || "");
                                                setDuration(t.duration || "");
                                                setPurchaseDate(t.purchase_date || "");
                                            }}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => setDeletingTransaction(t)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <AlertDialog open={!!deletingTransaction} onOpenChange={() => setDeletingTransaction(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir esta transação de R$ {deletingTransaction?.amount.toFixed(2)}? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
