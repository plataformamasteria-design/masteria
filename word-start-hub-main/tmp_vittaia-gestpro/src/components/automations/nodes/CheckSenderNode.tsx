import { memo, useState, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { PhoneCall, Plus, X, Upload, Trash2, Save, DownloadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/components/ui/select";
import { NodeStatsBar } from "./NodeStatsBar";
import { NodeOutputPanel } from "./NodeOutputPanel";
import { NodeHeader } from "./NodeHeader";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";

const sheetSchema = z.array(z.array(z.unknown()));

function CheckSenderNodeComponent({ id, data }: NodeProps) {
    const config = (data as any)?.config || {};
    const customLabel = (data as any)?.label || "";
    const [phones, setPhones] = useState<string[]>(config.phones || [""]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { currentOrganization } = useOrganization();
    // Resolvendo context drop do React Flow com o cache
    const orgId = currentOrganization?.id || localStorage.getItem('current_organization_id');

    const { data: savedLists, refetch } = useQuery({
        queryKey: ["broadcast-lists", orgId],
        enabled: !!orgId,
        queryFn: async () => {
            const { data, error } = await supabase.from("broadcast_lists")
                .select("id, name, phones")
                .eq("organization_id", orgId)
                .order("created_at", { ascending: false });
            if (error) { toast({ variant: "destructive", title: "Erro ao carregar listas salvas" }); return []; }
            return data || [];
        }
    });

    const handleSaveToLists = async () => {
        if (!orgId) {
            toast({ variant: "destructive", title: "A sessão perdeu a referência da clínica! Por favor, recarregue a página (F5)." });
            return;
        }

        const cleanPhones = phones.filter(p => !!p.trim());
        if (cleanPhones.length === 0) return toast({ variant: "destructive", title: "A lista atual está vazia!" });

        let listName: string | null = "";
        try {
            listName = window.prompt("Dê um nome para gravar esta Lista na Aba de Disparos:");
        } catch (e) {
            listName = `Lista Salva - ${new Date().toLocaleDateString()}`;
        }

        if (listName === null) return;
        if (!listName.trim()) listName = `Lista Salva - ${new Date().toLocaleDateString()}`;

        const { error } = await supabase.from("broadcast_lists").insert({
            organization_id: orgId,
            name: listName,
            phones: cleanPhones,
            phone_count: cleanPhones.length
        });

        if (error) {
            toast({ variant: "destructive", title: "Erro ao salvar lista: " + error.message });
        } else {
            toast({ title: "Lista salva nas configurações do sistema!" });
            refetch();
        }
    };

    const handleSelectSavedList = (listId: string) => {
        const list = savedLists?.find((l: any) => l.id === listId);
        if (!list) return;
        const combined = [...phones.filter(p => !!p.trim()), ...(list.phones || [])];
        if (combined.length === 0) return toast({ title: "Essa lista salva está vazia" });
        const uniquePhones = Array.from(new Set(combined));
        setPhones(uniquePhones);
        update({ phones: uniquePhones });
        toast({ title: `Carregados ${list.phones?.length || 0} números da lista [${list.name}]!` });
    };

    useEffect(() => {
        if (config.phones?.length) setPhones(config.phones);
    }, [JSON.stringify(config.phones)]);

    const update = (updates: Record<string, any>) => {
        (data as any)?.onChange?.(id, { config: { ...(data as any)?.config, ...updates } });
    };

    const addValue = () => {
        const nv = [...phones, ""];
        setPhones(nv);
        update({ phones: nv });
    };

    const removeValue = (i: number) => {
        const nv = phones.filter((_, idx) => idx !== i);
        // Ensure at least one empty input if list is empty
        if (nv.length === 0) nv.push("");
        setPhones(nv);
        update({ phones: nv });
    };

    const updateValue = (i: number, val: string) => {
        const nv = [...phones];
        nv[i] = val;
        setPhones(nv);
        update({ phones: nv });
    };

    const clearAll = () => {
        const nv = [""];
        setPhones(nv);
        update({ phones: nv });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];

                // Convert to array of arrays to handle files without headers seamlessly
                const rawParsed = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const parseResult = sheetSchema.safeParse(rawParsed);

                if (!parseResult.success) {
                    toast({ variant: "destructive", title: "Formato de planilha inválido ou dados corrompidos." });
                    return;
                }

                const dataRaw = parseResult.data;

                if (dataRaw.length === 0) {
                    toast({ variant: "destructive", title: "Planilha vazia ou em formato inválido." });
                    return;
                }

                let phoneColumnIndex = -1;

                // Check if the first row contains headers
                const firstRow = dataRaw[0] || [];
                const phoneKeywords = ["telefone", "celular", "whatsapp", "numero", "fone", "phone"];

                for (let i = 0; i < firstRow.length; i++) {
                    const header = String(firstRow[i] || "").toLowerCase().trim();
                    if (phoneKeywords.some(kw => header.includes(kw))) {
                        phoneColumnIndex = i;
                        break;
                    }
                }

                let newPhones: string[] = [];
                let startRow = 0;

                // If explicit header found, start from row 1, else assume column 0 and start from row 0
                if (phoneColumnIndex !== -1) {
                    startRow = 1;
                } else {
                    phoneColumnIndex = 0; // fallback to first column
                }

                for (let i = startRow; i < dataRaw.length; i++) {
                    const row = dataRaw[i];
                    if (row && row[phoneColumnIndex] !== undefined) {
                        const rawVal = String(row[phoneColumnIndex]);

                        // Split by common delimiters (newline, comma, slash, semicolon)
                        const parts = rawVal.split(/[\n,;\/]+/);

                        for (const part of parts) {
                            const cleanVal = part.replace(/\D/g, "");
                            // Only add if it looks like a plausible phone number (e.g., DDD + 8/9 digits)
                            // Limiting to <= 15 to prevent catching concatenated garbage
                            if (cleanVal.length >= 10 && cleanVal.length <= 15) {
                                newPhones.push(cleanVal);
                            }
                        }
                    }
                }

                if (newPhones.length > 0) {
                    // Combine existing with new, filter out empty initial strings, and deduplicate
                    const combined = [...phones.filter(p => p.trim() !== ""), ...newPhones];
                    const uniquePhones = Array.from(new Set(combined));

                    setPhones(uniquePhones);
                    update({ phones: uniquePhones });
                    toast({ title: `${newPhones.length} números importados com sucesso!` });
                } else {
                    toast({ title: "Nenhum número válido encontrado na planilha." });
                }

            } catch (error) {
                console.error(error);
                toast({ variant: "destructive", title: "Erro ao processar a planilha." });
            } finally {
                // Reset file input so same file can be clicked again
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.readAsBinaryString(file);
    };

    const isCollapsed = phones.length > 6;
    const previewPhones = isCollapsed ? phones.slice(0, 6) : phones;

    return (
        <div className="bg-card border border-border rounded-xl shadow-lg min-w-[260px] max-w-[320px] overflow-hidden group">
            <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-teal-500 !border-2 !border-background" />

            <NodeHeader
                nodeId={id}
                icon={<PhoneCall className="h-4 w-4 text-teal-500" />}
                defaultLabel="Checar Remetente"
                customLabel={customLabel}
                colorClass="bg-teal-500/10"
                textColorClass="text-teal-500"
                onExecute={() => (data as any)?.onExecute?.(id)}
                isExecuting={(data as any)?.isExecuting}
                onDuplicate={() => (data as any)?.onDuplicate?.(id)}
                onDelete={() => (data as any)?.onDelete?.(id)}
                onRename={(l) => (data as any)?.onRename?.(id, l)}
            />

            <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-muted-foreground whitespace-normal leading-relaxed">
                    Verifica se o contato atual possui um dos números abaixo (apenas DDD e número, ignora +55 ou 9 inicial).
                </p>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                            Telefones Alvo ({phones.filter(p => p.trim() !== "").length})
                        </Label>

                        <div className="flex gap-1 nodrag" title="Ações de Lista">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".csv, .xlsx, .xls"
                                onChange={handleFileUpload}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-teal-500 border-teal-500/20 hover:bg-teal-500/10 hover:text-teal-600"
                                onClick={() => fileInputRef.current?.click()}
                                title="Importar Excel/CSV"
                            >
                                <Upload className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-500 border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-600"
                                onClick={handleSaveToLists}
                                title="Salvar nos Disparos"
                            >
                                <Save className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    {/* Selector for Saved Lists */}
                    {savedLists && savedLists.length > 0 && (
                        <div className="mb-2.5">
                            <Select onValueChange={handleSelectSavedList} value="">
                                <SelectTrigger className="h-7 text-[10px] bg-background border-border shadow-sm">
                                    <div className="flex items-center gap-1.5 text-muted-foreground w-full">
                                        <DownloadCloud className="h-3 w-3 shrink-0" />
                                        <span className="truncate">Puxar Lista Salva...</span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {savedLists.map((l: any) => (
                                        <SelectItem key={l.id} value={l.id}>{l.name} ({l.phones?.length || 0})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-1.5 mt-1">
                        {previewPhones.map((val, i) => (
                            <div key={i} className="flex items-center gap-1">
                                <Input
                                    value={val}
                                    onChange={(e) => updateValue(i, e.target.value)}
                                    placeholder={`Ex: 5511999999999`}
                                    className="h-7 text-xs nodrag bg-background"
                                />
                                {!isCollapsed && phones.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeValue(i)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}

                        {isCollapsed && (
                            <div className="py-2 flex items-center justify-center bg-muted/30 rounded-md border border-dashed border-border mt-2">
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    + {phones.length - 6} números ocultos
                                </span>
                            </div>
                        )}

                        {!isCollapsed && (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full mt-2 border-dashed text-muted-foreground" onClick={addValue}>
                                <Plus className="h-3 w-3" />
                                Adicionar
                            </Button>
                        )}

                        {phones.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 w-full mt-1 text-red-500/70 hover:text-red-500 hover:bg-red-500/10" onClick={clearAll}>
                                <Trash2 className="h-3 w-3" />
                                Limpar toda a lista
                            </Button>
                        )}
                    </div>
                </div>

                {/* VIP Auto-Assign Integration */}
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.vip_auto_assign ?? false}
                            onChange={(e) => update({ vip_auto_assign: e.target.checked })}
                            className="accent-amber-500 w-3.5 h-3.5 nodrag"
                        />
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">👑 VIP Auto-Assign</span>
                    </label>
                    {config.vip_auto_assign && (
                        <div>
                            <Label className="text-[9px] text-muted-foreground">ID do Agente (opcional)</Label>
                            <Input
                                value={config.vip_agent_id || ""}
                                onChange={(e) => update({ vip_agent_id: e.target.value })}
                                placeholder="UUID do agente responsável"
                                className="h-6 text-[10px] nodrag mt-0.5"
                            />
                            <p className="text-[9px] text-muted-foreground mt-1">Se número bater, o chat é atribuído automaticamente a este agente.</p>
                        </div>
                    )}
                </div>
            </div>

            <NodeStatsBar stats={(data as any)?.stats} />

            <NodeOutputPanel
                nodeId={id}
                nodeLabel={customLabel || "Checar Remetente"}
                output={(data as any)?.nodeOutput}
                error={(data as any)?.nodeError}
                isPinned={(data as any)?.isPinned || false}
                isExecuting={(data as any)?.isExecuting || false}
                onExecute={() => (data as any)?.onExecute?.(id)}
                onPin={() => (data as any)?.onPinOutput?.(id)}
                onUnpin={() => (data as any)?.onUnpinOutput?.(id)}
            />

            <div className="flex justify-between px-6 pb-3">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] text-emerald-500 font-medium">Bateu o número</span>
                    <Handle type="source" position={Position.Bottom} id="yes" className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-[9px] text-red-500 font-medium">Outros números</span>
                    <Handle type="source" position={Position.Bottom} id="no" className="!w-3 !h-3 !bg-red-500 !border-2 !border-background !relative !transform-none !left-auto !right-auto" />
                </div>
            </div>
        </div>
    );
}

export const CheckSenderNode = memo(CheckSenderNodeComponent);
