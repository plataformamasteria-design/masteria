import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageUp, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LeadMultiSelect, type LeadOption } from "@/components/chat/LeadMultiSelect";

interface CreateGroupDialogProps {
  onChatCreated: (chatId: string) => void;
  onRefresh: () => void;
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ onChatCreated, onRefresh }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!currentOrganization?.id) return;
      const { data, error } = await supabase
        .from("chats")
        .select("id, phone, wa_name, custom_name")
        .eq("organization_id", currentOrganization.id)
        .eq("is_group", false)
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) return;
      if (!mounted) return;
      const options: LeadOption[] = (data || []).map((c: any) => {
        const label = c.custom_name || c.wa_name || c.phone;
        return { id: c.id, label, subtitle: c.phone, value: c.phone };
      });
      setLeadOptions(options);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [currentOrganization?.id]);

  const idToRemote = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of leadOptions) map.set(o.id, o.value);
    return map;
  }, [leadOptions]);

  const normalizeRemoteJidToDigits = (remoteJid: string) => {
    return String(remoteJid || "").split("@")[0].replace(/\D/g, "");
  };

  const uploadGroupPhoto = async (orgId: string, file: File) => {
    const { uploadFileWithFallback } = await import("@/lib/r2Upload");
    return uploadFileWithFallback(file, `groups/${orgId}`, file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentOrganization?.id) {
      toast({
        title: "Erro",
        description: "Selecione uma organização antes de criar um grupo",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Erro",
        description: "O nome do grupo é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const organizationId = currentOrganization.id;
      const participantsDigits = selectedLeadIds
        .map((id) => idToRemote.get(id) || "")
        .filter(Boolean)
        .map(normalizeRemoteJidToDigits)
        .filter(Boolean);

      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: {
          action: "create-group",
          organization_id: organizationId,
          subject: subject.trim(),
          description: description.trim() ? description.trim() : undefined,
          participants: participantsDigits,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) {
        throw new Error((data as any)?.message || (data as any)?.details || (data as any)?.error);
      }

      // Best-effort: infer group JID from common response shapes
      const groupJid =
        (data as any)?.data?.jid ||
        (data as any)?.data?.group?.id ||
        (data as any)?.data?.id ||
        (data as any)?.jid ||
        (data as any)?.id ||
        null;

      if (!groupJid || typeof groupJid !== "string" || !groupJid.includes("@g.us")) {
        toast({
          title: "Grupo criado",
          description: "Grupo criado no WhatsApp. A conversa aparecerá quando chegar o primeiro evento de grupo/mensagem.",
        });

        setSubject("");
        setDescription("");
        setSelectedLeadIds([]);
        setPhotoFile(null);
        setOpen(false);
        onRefresh();
        return;
      }

      // Optional: upload + apply group photo
      let photoUrl: string | null = null;
      if (photoFile) {
        try {
          photoUrl = await uploadGroupPhoto(organizationId, photoFile);
          await supabase.functions.invoke("evolution-api", {
            body: {
              action: "group-update-picture",
              organization_id: organizationId,
              groupJid,
              pictureUrl: photoUrl,
            },
          });
        } catch (e) {
          console.warn("[CreateGroupDialog] Failed to set group picture:", e);
          // best effort; continue
        }
      }

      // Create or reuse a local chat entry so the group appears immediately in the platform
      const { data: existing } = await supabase
        .from("chats")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("phone", groupJid)
        .maybeSingle();

      let chatId = existing?.id as string | undefined;

      if (!chatId) {
        const { data: inserted, error } = await supabase
          .from("chats")
          .insert({
            organization_id: organizationId,
            phone: groupJid,
            is_group: true,
            group_name: subject.trim(),
            group_description: description.trim() ? description.trim() : null,
            group_photo_url: photoUrl,
            agent_off: true, // grupos começam com bot desligado por padrão
            hidden_from_chat: false,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        chatId = inserted?.id;
      }

      toast({
        title: "Grupo criado",
        description: "Grupo criado no WhatsApp e adicionado na plataforma.",
      });

      onRefresh();
      if (chatId) onChatCreated(chatId);

      setSubject("");
      setDescription("");
      setSelectedLeadIds([]);
      setPhotoFile(null);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível criar o grupo";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2 md:px-3"
                aria-label="Novo grupo"
              >
                <UsersRound className="h-4 w-4 shrink-0" />
                <span className="text-xs hidden sm:inline">Novo grupo</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Novo grupo
          </TooltipContent>
        </Tooltip>

        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Novo Grupo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group_subject">
                Nome do grupo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group_subject"
                placeholder="Ex: Suporte - Equipe"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Algumas versões da Evolution exigem pelo menos 1 participante; quando você criar “sem participantes”,
                vamos usar automaticamente o número da própria instância (se disponível) para atender essa regra.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Participantes (da base)</Label>
              <LeadMultiSelect
                items={leadOptions}
                value={selectedLeadIds}
                onChange={setSelectedLeadIds}
                disabled={loading}
                placeholder="Selecionar participantes..."
              />
              <p className="text-xs text-muted-foreground">
                Vamos enviar para o WhatsApp o identificador do lead (remoteJid) normalizado.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Foto do grupo (opcional)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  disabled={loading}
                  className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-accent"
                />
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled>
                  <ImageUp className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A imagem é enviada para o WhatsApp (quando a API suportar) e salva na plataforma.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="group_description">Descrição (opcional)</Label>
              <Textarea
                id="group_description"
                placeholder="Descrição do grupo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Grupo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};
