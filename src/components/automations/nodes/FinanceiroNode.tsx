import { memo, useState, useEffect } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";

function FinanceiroNodeComponent({ id, data }: NodeProps) {
  const config = (data as any)?.config || {};
  const customLabel = (data as any)?.label || "";
  const [transactionType, setTransactionType] = useState(config.transaction_type || "income");
  const [amount, setAmount] = useState(config.amount || "");
  const [description, setDescription] = useState(config.description || "");
  const [productName, setProductName] = useState(config.product_name || "");

  useEffect(() => { setTransactionType(config.transaction_type || "income"); }, [config.transaction_type]);
  useEffect(() => { setAmount(config.amount || ""); }, [config.amount]);
  useEffect(() => { setDescription(config.description || ""); }, [config.description]);
  useEffect(() => { setProductName(config.product_name || ""); }, [config.product_name]);

  const update = (updates: Record<string, string>) => { (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } }); };

  return (
    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] min-w-[260px] overflow-visible group">
      <Handle type="target" position={Position.Top} className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
      <NodeHeader nodeId={id} icon={<DollarSign className="h-4 w-4 text-green-500" />} defaultLabel="Financeiro" customLabel={customLabel} colorClass="bg-green-50 dark:bg-green-900/30" textColorClass="text-green-500" onExecute={() => (data as any)?.onExecute?.(id)} isExecuting={(data as any)?.isExecuting} onDuplicate={() => (data as any)?.onDuplicate?.(id)} onDelete={() => (data as any)?.onDelete?.(id)} onRename={(l) => (data as any)?.onRename?.(id, l)} />
      <div className="px-4 py-3 space-y-2">
        <div><Label className="text-[10px] text-muted-foreground">Tipo</Label><Select value={transactionType} onValueChange={(v) => { setTransactionType(v); update({ transaction_type: v }); }}><SelectTrigger className="h-8 text-xs nodrag mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="income">Receita</SelectItem><SelectItem value="expense">Despesa</SelectItem></SelectContent></Select></div>
        <div><Label className="text-[10px] text-muted-foreground">Valor (R$)</Label><Input value={amount} onChange={(e) => { setAmount(e.target.value); update({ amount: e.target.value }); }} placeholder="0,00" className="h-8 text-xs nodrag mt-1" type="number" step="0.01" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Produto / Serviço</Label><Input value={productName} onChange={(e) => { setProductName(e.target.value); update({ product_name: e.target.value }); }} placeholder="Nome do produto" className="h-8 text-xs nodrag mt-1" /></div>
        <div><Label className="text-[10px] text-muted-foreground">Descrição (opcional)</Label><Input value={description} onChange={(e) => { setDescription(e.target.value); update({ description: e.target.value }); }} placeholder="Venda automática via automação" className="h-8 text-xs nodrag mt-1" /></div>
      </div>
      <NodeStatsBar stats={(data as any)?.stats} />
      <NodeOutputPanel nodeId={id} nodeLabel={customLabel || "Financeiro"} output={(data as any)?.nodeOutput} error={(data as any)?.nodeError} isPinned={(data as any)?.isPinned || false} isExecuting={(data as any)?.isExecuting || false} onExecute={() => (data as any)?.onExecute?.(id)} onPin={() => (data as any)?.onPinOutput?.(id)} onUnpin={() => (data as any)?.onUnpinOutput?.(id)} />
      <Handle type="source" position={Position.Bottom} className="!w-4 !h-4 !bg-green-50 dark:bg-green-900/300 !border-[3px] !border-white dark:border-zinc-900 dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125 px] dark:!border-zinc-950 shadow-sm z-50 transition-transform hover:scale-125" />
    </div>
  );
}

export const FinanceiroNode = memo(FinanceiroNodeComponent);
