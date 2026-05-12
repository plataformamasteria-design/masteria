import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName?: string;
  transactionId?: string;
  onSuccess?: () => void;
}

interface TransactionData {
  amount: string;
  product_name: string;
  description: string;
  duration: string;
  purchase_date: string;
}

export function TransactionDialog({
  open,
  onOpenChange,
  chatId,
  chatName,
  transactionId,
  onSuccess,
}: TransactionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [data, setData] = useState<TransactionData>({
    amount: "",
    product_name: "",
    description: "",
    duration: "",
    purchase_date: format(new Date(), "yyyy-MM-dd"),
  });
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (open && transactionId) {
      fetchTransaction();
    } else if (open && !transactionId) {
      setData({
        amount: "",
        product_name: "",
        description: "",
        duration: "",
        purchase_date: format(new Date(), "yyyy-MM-dd"),
      });
    }
  }, [open, transactionId]);

  const fetchTransaction = async () => {
    if (!transactionId) return;
    
    setLoadingData(true);
    try {
      const { data: transaction, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();

      if (error) throw error;

      setData({
        amount: String(transaction.amount),
        product_name: transaction.product_name || "",
        description: transaction.description || "",
        duration: transaction.duration || "",
        purchase_date: transaction.purchase_date || format(new Date(), "yyyy-MM-dd"),
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar transação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.amount || parseFloat(data.amount) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Por favor, insira um valor válido",
        variant: "destructive",
      });
      return;
    }

    // Get organization_id from chat if not available from context
    let organizationId = currentOrganization?.id;
    
    if (!organizationId) {
      const { data: chatData } = await supabase
        .from("chats")
        .select("organization_id")
        .eq("id", chatId)
        .single();
      
      organizationId = chatData?.organization_id;
    }

    if (!organizationId) {
      toast({
        title: "Erro",
        description: "Não foi possível identificar a organização",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const transactionData = {
        amount: parseFloat(data.amount),
        product_name: data.product_name || null,
        description: data.description || null,
        duration: data.duration || null,
        purchase_date: data.purchase_date || null,
        chat_id: chatId,
        organization_id: organizationId,
        created_by: userData?.user?.id || null,
      };

      if (transactionId) {
        // Don't update organization_id or created_by on edit
        const { created_by, organization_id, ...updateData } = transactionData;
        const { error } = await supabase
          .from("transactions")
          .update(updateData)
          .eq("id", transactionId);

        if (error) throw error;

        toast({
          title: "Transação atualizada",
          description: "A transação foi atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("transactions")
          .insert(transactionData);

        if (error) throw error;

        toast({
          title: "Transação criada",
          description: "A transação foi registrada com sucesso",
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar transação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", transactionId);

      if (error) throw error;

      toast({
        title: "Transação excluída",
        description: "A transação foi excluída com sucesso",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir transação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {transactionId ? "Editar Transação" : "Nova Transação"}
          </DialogTitle>
          <DialogDescription>
            {chatName ? `Registrar venda para ${chatName}` : "Registrar uma nova venda"}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={data.amount}
                onChange={(e) => setData({ ...data, amount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_name">Produto/Serviço</Label>
              <Input
                id="product_name"
                placeholder="Ex: Consultoria, Produto X"
                value={data.product_name}
                onChange={(e) => setData({ ...data, product_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duração</Label>
              <Input
                id="duration"
                placeholder="Ex: 1 mês, 6 meses, Vitalício"
                value={data.duration}
                onChange={(e) => setData({ ...data, duration: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">Data da Compra</Label>
              <Input
                id="purchase_date"
                type="date"
                value={data.purchase_date}
                onChange={(e) => setData({ ...data, purchase_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Observações</Label>
              <Textarea
                id="description"
                placeholder="Detalhes adicionais..."
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2">
              {transactionId && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {transactionId ? "Salvar" : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
