import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Edit2, Upload, Users, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function BroadcastListsTab() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["broadcast-lists", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("broadcast_lists")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
      const parsed: string[] = [];
      lines.forEach(line => {
        const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/\D/g, "")).filter(p => p.length >= 10);
        parsed.push(...parts);
      });
      const unique = [...new Set([...phones, ...parsed])];
      setPhones(unique);
      toast({ title: `${parsed.length} números importados` });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddPhones = () => {
    if (!phoneInput.trim()) return;
    const parts = phoneInput.split(/[,;\n]+/).map(p => p.trim().replace(/\D/g, "")).filter(p => p.length >= 10);
    const unique = [...new Set([...phones, ...parts])];
    setPhones(unique);
    setPhoneInput("");
  };

  const handleSave = async () => {
    if (!orgId || !name.trim() || phones.length === 0) {
      toast({ variant: "destructive", title: "Preencha nome e adicione números" });
      return;
    }
    try {
      if (editingId) {
        const { error } = await supabase.from("broadcast_lists").update({ name, phones, phone_count: phones.length }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("broadcast_lists").insert({ organization_id: orgId, name, phones, phone_count: phones.length });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
      toast({ title: editingId ? "Lista atualizada" : "Lista salva" });
      resetDialog();
    } catch (err: any) {
      console.error("Erro ao salvar lista:", err);
      toast({ variant: "destructive", title: "Erro ao salvar lista", description: err.message || "Verifique as permissões" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("broadcast_lists").delete().eq("id", deleteId);
    queryClient.invalidateQueries({ queryKey: ["broadcast-lists"] });
    setDeleteId(null);
    toast({ title: "Lista excluída" });
  };

  const handleEdit = (list: any) => {
    setEditingId(list.id);
    setName(list.name);
    setPhones(list.phones || []);
    setDialogOpen(true);
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setName("");
    setPhones([]);
    setPhoneInput("");
  };

  const handleCopyPhones = (list: any) => {
    navigator.clipboard.writeText((list.phones || []).join(", "));
    toast({ title: "Números copiados para a área de transferência" });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Listas de Contatos</h2>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Nova Lista</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Lista" : "Nova Lista"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome da lista</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Leads Janeiro" />
                </div>
                <div>
                  <Label>Importar arquivo (CSV, TXT)</Label>
                  <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" className="w-full mt-1" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Enviar Arquivo
                  </Button>
                </div>
                <div>
                  <Label>Ou digite números separados por vírgula</Label>
                  <div className="flex gap-2 mt-1">
                    <Textarea value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="5511999999999, 5521888888888" rows={2} className="flex-1" />
                    <Button onClick={handleAddPhones} size="sm" className="self-end">Adicionar</Button>
                  </div>
                </div>
                {phones.length > 0 && (
                  <div>
                    <Label>{phones.length} números na lista</Label>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto mt-1">
                      {phones.slice(0, 30).map(p => (
                        <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                      {phones.length > 30 && <Badge variant="outline">+{phones.length - 30} mais</Badge>}
                    </div>
                  </div>
                )}
                <Button onClick={handleSave} className="w-full">Salvar Lista</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {lists.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhuma lista salva ainda. Crie sua primeira lista de contatos.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lists.map((list: any) => (
              <Card key={list.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="truncate">{list.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyPhones(list)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(list)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(list.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {list.phone_count} contatos
                    </div>
                    <span className="text-xs">
                      {format(new Date(list.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. A lista de contatos será removida permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}