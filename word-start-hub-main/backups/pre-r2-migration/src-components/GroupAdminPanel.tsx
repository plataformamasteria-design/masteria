import { useEffect, useMemo, useState } from "react";
import { Copy, ImageUp, Link2, UserMinus, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadMultiSelect, type LeadOption } from "@/components/chat/LeadMultiSelect";
import { formatBrPhoneFromDigits } from "@/lib/group-participants";

function normalizeRemoteJidToDigits(remoteJid: string): string {
  // "551199...@s.whatsapp.net" => "551199..."; keep only digits
  return String(remoteJid || "")
    .split("@")[0]
    .replace(/\D/g, "");
}

async function uploadGroupPhoto(orgId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `groups/${orgId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("chat-files")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("chat-files").getPublicUrl(path);
  return data.publicUrl;
}

interface GroupAdminPanelProps {
  organizationId: string;
  groupChatId: string; // internal chat id
  groupJid: string; // chat.phone (must contain @g.us)
  canManage?: boolean;
}

type GroupParticipantRow = {
  id: string;
  participant_phone: string;
  participant_jid?: string;
  display_name: string | null;
  is_admin: boolean;
};

export function GroupAdminPanel({ organizationId, groupChatId, groupJid, canManage = true }: GroupAdminPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipantRow[]>([]);
  const [addSelection, setAddSelection] = useState<string[]>([]);
  const [removeSelection, setRemoveSelection] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!organizationId || !groupChatId) return;

      // 1) Best-effort: ask backend to sync latest group info/participants.
      // If the caller isn't allowed, it will simply fail and we still show what we have locally.
      try {
        await supabase.functions.invoke("evolution-api", {
          body: { action: "group-info", organization_id: organizationId, groupJid },
          // @ts-expect-error
          query: { action: "group-info", organization_id: organizationId },
        });
      } catch {
        // ignore
      }

      // 2) Load group participants snapshot
      const { data: members } = await (supabase as any)
        .from("group_participants")
        .select("id, participant_phone, participant_jid, display_name, is_admin")
        .eq("group_chat_id", groupChatId)
        .order("is_admin", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(300);

      // 3) Load leads to allow adding
      const { data: leads, error } = await supabase
        .from("chats")
        .select("id, phone, wa_name, custom_name")
        .eq("organization_id", organizationId)
        .eq("is_group", false)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) return;
      if (!mounted) return;

      setGroupParticipants((members || []) as any);

      const options: LeadOption[] = (leads || []).map((c: any) => {
        const label = c.custom_name || c.wa_name || c.phone;
        return {
          id: c.id,
          label,
          subtitle: c.phone,
          value: c.phone,
        };
      });
      setLeadOptions(options);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [organizationId, groupChatId, groupJid]);

  const idToValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of leadOptions) map.set(o.id, o.value);
    return map;
  }, [leadOptions]);

  const memberPhonesSet = useMemo(() => {
    return new Set(groupParticipants.map((p) => String(p.participant_phone || '').replace(/\D/g, '')).filter(Boolean));
  }, [groupParticipants]);

  const addableLeadOptions = useMemo(() => {
    // only leads NOT already in the group
    return leadOptions.filter((o) => !memberPhonesSet.has(normalizeRemoteJidToDigits(o.value)));
  }, [leadOptions, memberPhonesSet]);

  const removableOptions = useMemo<LeadOption[]>(() => {
    // only participants that ARE currently in the group
    return groupParticipants.map((p) => {
      const digits = String(p.participant_phone || "").replace(/\D/g, "");
      const phoneFmt = formatBrPhoneFromDigits(digits) || p.participant_phone;
      const label = p.display_name || phoneFmt || p.participant_phone;
      const subtitle = `${phoneFmt || p.participant_phone}${p.is_admin ? " • Admin" : ""}`;
      return {
        id: p.id,
        label,
        subtitle,
        value: p.participant_phone,
      };
    });
  }, [groupParticipants]);

  const invokeEvolution = async (action: string, body: any) => {
    const { data, error } = await supabase.functions.invoke("evolution-api", {
      body,
      // @ts-expect-error - invoke supports query via options in newer SDKs; fallback handled by backend parsing if absent
      query: { action, organization_id: organizationId },
    });

    // Some environments ignore `query` above; fallback to direct fetch is forbidden.
    // Therefore, the backend must also accept action/organization_id inside body.
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any)?.message || (data as any)?.error);
    return data;
  };

  const handleAddParticipants = async () => {
    if (!addSelection.length) return;
    setLoading(true);
    try {
      const participants = addSelection
        .map((id) => idToValue.get(id) || "")
        .filter(Boolean)
        .map(normalizeRemoteJidToDigits)
        .filter(Boolean);

      await invokeEvolution("group-update-participants", {
        action: "group-update-participants",
        organization_id: organizationId,
        groupJid,
        operation: "add",
        participants,
      });

      // Force a best-effort sync to ensure the snapshot updates immediately.
      try {
        await supabase.functions.invoke("evolution-api", {
          body: { action: "group-info", organization_id: organizationId, groupJid },
          // @ts-expect-error
          query: { action: "group-info", organization_id: organizationId },
        });
      } catch {
        // ignore
      }

      toast({ title: "Sucesso", description: "Participantes adicionados." });
      setAddSelection([]);

      // refresh snapshot
      const { data: members } = await (supabase as any)
        .from("group_participants")
        .select("id, participant_phone, participant_jid, display_name, is_admin")
        .eq("group_chat_id", groupChatId)
        .order("is_admin", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(300);
      setGroupParticipants((members || []) as any);
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível adicionar participantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipants = async () => {
    if (!removeSelection.length) return;
    setLoading(true);
    try {
      // removeSelection contains group_participants IDs; only allow removing existing members
      const participants = removeSelection
        .map((id) => groupParticipants.find((p) => p.id === id)?.participant_phone || "")
        .filter(Boolean)
        .map(normalizeRemoteJidToDigits)
        .filter((p) => memberPhonesSet.has(p));

      await invokeEvolution("group-update-participants", {
        action: "group-update-participants",
        organization_id: organizationId,
        groupJid,
        operation: "remove",
        participants,
      });

      // Force a best-effort sync to ensure the snapshot updates immediately.
      try {
        await supabase.functions.invoke("evolution-api", {
          body: { action: "group-info", organization_id: organizationId, groupJid },
          // @ts-expect-error
          query: { action: "group-info", organization_id: organizationId },
        });
      } catch {
        // ignore
      }

      toast({ title: "Sucesso", description: "Participantes removidos." });
      setRemoveSelection([]);

      // refresh snapshot
      const { data: members } = await (supabase as any)
        .from("group_participants")
        .select("id, participant_phone, participant_jid, display_name, is_admin")
        .eq("group_chat_id", groupChatId)
        .order("is_admin", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(300);
      setGroupParticipants((members || []) as any);
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível remover participantes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteLink = async () => {
    setLoading(true);
    try {
      const data = await invokeEvolution("group-invite", {
        action: "group-invite",
        organization_id: organizationId,
        groupJid,
      });
      const inviteUrl = (data as any)?.data?.inviteUrl || (data as any)?.inviteUrl;
      if (!inviteUrl) throw new Error("Não foi possível obter o link de convite");
      await navigator.clipboard.writeText(String(inviteUrl));
      toast({ title: "Copiado", description: "Link de convite copiado." });
      setInviteUrl(String(inviteUrl));
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível gerar o link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhoto = async () => {
    if (!photoFile) return;
    setLoading(true);
    try {
      const publicUrl = await uploadGroupPhoto(organizationId, photoFile);
      await invokeEvolution("group-update-picture", {
        action: "group-update-picture",
        organization_id: organizationId,
        groupJid,
        pictureUrl: publicUrl,
      });

      // Keep platform in sync as well
      await supabase
        .from("chats")
        .update({ group_photo_url: publicUrl } as any)
        .eq("id", groupChatId);

      toast({ title: "Sucesso", description: "Foto do grupo atualizada." });
      setPhotoFile(null);
    } catch (e) {
      toast({
        title: "Erro",
        description: e instanceof Error ? e.message : "Não foi possível atualizar a foto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!canManage && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
          Este WhatsApp não é administrador do grupo. Você pode visualizar os participantes, mas não pode gerenciar.
        </div>
      )}

      <div className="space-y-2">
        <Label>Adicionar participantes</Label>
        <LeadMultiSelect
          items={addableLeadOptions}
          value={addSelection}
          onChange={setAddSelection}
          disabled={loading || !canManage}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleAddParticipants}
            disabled={loading || !canManage || addSelection.length === 0}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Remover participantes</Label>
        <LeadMultiSelect
          items={removableOptions}
          value={removeSelection}
          onChange={setRemoveSelection}
          disabled={loading || !canManage}
          placeholder="Selecionar participantes..."
        />
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleRemoveParticipants}
            disabled={loading || !canManage || removeSelection.length === 0}
            className="gap-2"
          >
            <UserMinus className="h-4 w-4" />
            Remover
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button variant="outline" onClick={handleInviteLink} disabled={loading || !canManage} className="gap-2">
          <Link2 className="h-4 w-4" />
          Gerar link
          <Copy className="h-4 w-4 opacity-60" />
        </Button>

        {inviteUrl ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteUrl} className="text-xs" />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast({ title: "Copiado", description: "Link copiado novamente." });
              }}
            >
              <Copy className="h-4 w-4" />
              Copiar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-full rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              O link aparecerá aqui após gerar.
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            disabled={loading || !canManage}
            className="block w-full text-sm text-muted-foreground file:mr-2 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-sm file:text-foreground hover:file:bg-accent"
          />
          <Button
            type="button"
            onClick={handleUpdatePhoto}
            disabled={loading || !canManage || !photoFile}
            className="shrink-0 gap-2"
          >
            <ImageUp className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}
