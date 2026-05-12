import { AudienceSelectionCard } from './AudienceSelectionCard';
import { AudienceExclusionCard } from './AudienceExclusionCard';
import { CampaignSettingsPanel } from './CampaignSettingsPanel';
import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, X, Play, Clock, Users, Send, Loader2, FileSpreadsheet, Tag, GitBranch,
  Globe, Filter, ShieldCheck, Save, CheckCircle2, XCircle, Search, AlertTriangle, ListPlus, ServerCog, MessageSquare, MessageCircle, Smartphone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { MessagePreview } from "./MessagePreview";
import { CommandStepEditor } from "@/components/commands/CommandStepEditor";

type TargetType = "list" | "tags" | "funnel" | "all" | "saved_list";
type ListInputMode = "manual" | "file";

interface CampaignData {
  name: string;
  message_content: string;
  target_type: string;
  target_phones: string[];
  target_tag_ids: string[];
  target_funnel_id: string | null;
  target_stage_id: string | null;
  delay_seconds: number;
}

interface NewCampaignTabProps {
  prefillCampaign?: CampaignData | null;
  onPrefillConsumed?: () => void;
}

interface MessageStep {
  id?: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content?: string;
  file_url?: string;
  file_name?: string;
}

function parseTemplateConfig(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.steps && Array.isArray(parsed.steps)) return parsed;
    if (Array.isArray(parsed)) return { steps: parsed };
  } catch { }
  return { steps: [{ step_order: 1, message_type: 'text', content }] };
}

export function NewCampaignTab({ prefillCampaign, onPrefillConsumed }: NewCampaignTabProps) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [campaignName, setCampaignName] = useState("");
  const [messageSteps, setMessageSteps] = useState<MessageStep[]>([
    { id: crypto.randomUUID(), step_order: 1, message_type: 'text', content: '' }
  ]);
  const [targetType, setTargetType] = useState<TargetType>("list");
  const [listInputMode, setListInputMode] = useState<ListInputMode>("manual");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneList, setPhoneList] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedSavedListId, setSelectedSavedListId] = useState("");
  const [excludeTargetType, setExcludeTargetType] = useState<string>("none");
  const [excludeSelectedTagIds, setExcludeSelectedTagIds] = useState<string[]>([]);
  const [excludeSelectedFunnelId, setExcludeSelectedFunnelId] = useState("");
  const [excludeSelectedStageId, setExcludeSelectedStageId] = useState("");
  const [excludeSelectedSavedListId, setExcludeSelectedSavedListId] = useState("");
  const [finalPreviewList, setFinalPreviewList] = useState<string[] | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState(1.5);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [channelType, setChannelType] = useState<"vitta" | "meta">("vitta");
  const [selectedMetaTemplateId, setSelectedMetaTemplateId] = useState("");

  const [campaignActionType, setCampaignActionType] = useState<"message" | "automation">("message");
  const [selectedAutomationId, setSelectedAutomationId] = useState("");

  const { data: availableAutomations } = useQuery({
    queryKey: ["broadcast-automations", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('automations')
        .select('id, name')
        .eq('organization_id', orgId)
        .eq('status', 'active');
      return data || [];
    }
  });

  const [autoAssignTag, setAutoAssignTag] = useState(false);
  const [autoAssignTagId, setAutoAssignTagId] = useState("");
  const [autoAssignFunnel, setAutoAssignFunnel] = useState(false);
  const [autoAssignFunnelId, setAutoAssignFunnelId] = useState("");
  const [autoAssignStageId, setAutoAssignStageId] = useState("");

  const [isFiltering, setIsFiltering] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [invalidNumbers, setInvalidNumbers] = useState<string[]>([]);
  const [showInvalidDialog, setShowInvalidDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    setFinalPreviewList(null);
  }, [
    targetType, phoneList, selectedTagIds, selectedFunnelId, selectedStageId, selectedSavedListId,
    excludeTargetType, excludeSelectedTagIds, excludeSelectedFunnelId, excludeSelectedStageId, excludeSelectedSavedListId
  ]);

  // Prefill from repeated campaign
  useEffect(() => {
    if (prefillCampaign) {
      setCampaignName(prefillCampaign.name ? `${prefillCampaign.name} (cópia)` : "");
      try {
        const parsed = JSON.parse(prefillCampaign.message_content || "[]");
        if (Array.isArray(parsed)) setMessageSteps(parsed);
        else if (parsed?.steps) setMessageSteps(parsed.steps);
        else setMessageSteps([{ step_order: 1, message_type: 'text', content: prefillCampaign.message_content || '' }]);
      } catch {
        setMessageSteps([{ step_order: 1, message_type: 'text', content: prefillCampaign.message_content || '' }]);
      }
      setTargetType((prefillCampaign.target_type as TargetType) || "list");
      setPhoneList(prefillCampaign.target_phones || []);
      setDelaySeconds(prefillCampaign.delay_seconds || 5);
      if (prefillCampaign.target_tag_ids?.length) setSelectedTagIds(prefillCampaign.target_tag_ids);
      if (prefillCampaign.target_funnel_id) setSelectedFunnelId(prefillCampaign.target_funnel_id);
      if (prefillCampaign.target_stage_id) setSelectedStageId(prefillCampaign.target_stage_id);
      onPrefillConsumed?.();
    }
  }, [prefillCampaign]);

  const { data: tags = [], isLoading: loadingTags } = useQuery({
    queryKey: ["tags", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("tags").select("id, name, color").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: funnels = [], isLoading: loadingFunnels } = useQuery({
    queryKey: ["funnels", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("funnels").select("id, name").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: savedLists = [], isLoading: loadingLists } = useQuery({
    queryKey: ["broadcast-lists", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("broadcast_lists").select("*").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["funnel-stages", selectedFunnelId],
    queryFn: async () => {
      if (!selectedFunnelId) return [];
      const { data } = await supabase.from("funnel_stages").select("id, name, color").eq("funnel_id", selectedFunnelId).order("order_position");
      return data || [];
    },
    enabled: !!selectedFunnelId,
  });

  const { data: autoAssignStages = [] } = useQuery({
    queryKey: ["funnel-stages-auto", autoAssignFunnelId],
    queryFn: async () => {
      if (!autoAssignFunnelId) return [];
      const { data } = await supabase.from("funnel_stages").select("id, name, color").eq("funnel_id", autoAssignFunnelId).order("order_position");
      return data || [];
    },
    enabled: !!autoAssignFunnelId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["broadcast-templates", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("broadcast_message_templates").select("*").eq("organization_id", orgId).order("name");
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: metaTemplates = [], isLoading: isLoadingMetaTemplates } = useQuery({
    queryKey: ["wa-official-templates-approved", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase.from("wa_official_templates").select("*").eq("organization_id", orgId).eq("status", "APPROVED").order("name");
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
      const phones: string[] = [];
      lines.forEach(line => {
        const parts = line.split(/[,;\t]+/).map(p => p.trim().replace(/\D/g, "")).filter(p => p.length >= 10);
        phones.push(...parts);
      });
      const unique = [...new Set([...phoneList, ...phones])];
      setPhoneList(unique);
      toast({ title: `${phones.length} números importados`, description: `Total: ${unique.length} números únicos` });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddPhones = () => {
    if (!phoneInput.trim()) return;
    const parts = phoneInput.split(/[,;\n]+/).map(p => p.trim().replace(/\D/g, "")).filter(p => p.length >= 10);
    const unique = [...new Set([...phoneList, ...parts])];
    setPhoneList(unique);
    setPhoneInput("");
  };

  const removePhone = (phone: string) => {
    setPhoneList(prev => prev.filter(p => p !== phone));
  };

  const handleLoadSavedList = (listId: string) => {
    setSelectedSavedListId(listId);
    const list = savedLists.find((l: any) => l.id === listId);
    if (list) {
      const unique = [...new Set([...phoneList, ...(list.phones || [])])];
      setPhoneList(unique);
      toast({ title: `${list.phones?.length || 0} números carregados da lista "${list.name}"` });
    }
  };

  const handleFilterRegistered = async () => {
    if (!orgId || phoneList.length === 0) return;
    setIsFiltering(true);
    try {
      const batchSize = 500;
      const existingPhones = new Set<string>();
      const allVariations: string[] = [];
      for (const phone of phoneList) {
        allVariations.push(phone);
        if (phone.startsWith("55") && phone.length === 13) allVariations.push("55" + phone.substring(2, 4) + phone.substring(5));
        if (phone.startsWith("55") && phone.length === 12) allVariations.push("55" + phone.substring(2, 4) + "9" + phone.substring(4));
      }
      const uniqueVariations = [...new Set(allVariations)];
      for (let i = 0; i < uniqueVariations.length; i += batchSize) {
        const batch = uniqueVariations.slice(i, i + batchSize);
        const { data } = await supabase.from("chats").select("phone").eq("organization_id", orgId).in("phone", batch);
        (data || []).forEach(c => existingPhones.add(c.phone));
      }
      const registeredOriginals = new Set<string>();
      for (const phone of phoneList) {
        if (existingPhones.has(phone)) { registeredOriginals.add(phone); continue; }
        if (phone.startsWith("55") && phone.length === 13 && existingPhones.has("55" + phone.substring(2, 4) + phone.substring(5))) registeredOriginals.add(phone);
        if (phone.startsWith("55") && phone.length === 12 && existingPhones.has("55" + phone.substring(2, 4) + "9" + phone.substring(4))) registeredOriginals.add(phone);
      }
      const filtered = phoneList.filter(p => !registeredOriginals.has(p));
      const removed = phoneList.length - filtered.length;
      setPhoneList(filtered);
      toast({ title: `${removed} leads já cadastrados removidos`, description: `Restam ${filtered.length} números não registrados` });
    } catch {
      toast({ variant: "destructive", title: "Erro ao filtrar" });
    } finally {
      setIsFiltering(false);
    }
  };

  const handleRemoveGroups = async () => {
    if (!orgId || phoneList.length === 0) return;
    setIsFiltering(true);
    try {
      const batchSize = 500;
      const existingGroups = new Set<string>();

      const allVariations: string[] = [];
      for (const phone of phoneList) {
        if (phone.length <= 14) {
          allVariations.push(phone);
          if (phone.startsWith("55") && phone.length === 13) allVariations.push("55" + phone.substring(2, 4) + phone.substring(5));
          if (phone.startsWith("55") && phone.length === 12) allVariations.push("55" + phone.substring(2, 4) + "9" + phone.substring(4));
        }
      }

      const uniqueVariations = [...new Set(allVariations)];
      for (let i = 0; i < uniqueVariations.length; i += batchSize) {
        const batch = uniqueVariations.slice(i, i + batchSize);
        const { data } = await supabase.from("chats").select("phone").eq("organization_id", orgId).eq("is_group", true).in("phone", batch);
        (data || []).forEach(c => existingGroups.add(c.phone));
      }

      const filtered = phoneList.filter(phone => {
        if (phone.length > 14) return false;

        let isGroupInDb = existingGroups.has(phone);
        if (!isGroupInDb && phone.startsWith("55") && phone.length === 13) isGroupInDb = existingGroups.has("55" + phone.substring(2, 4) + phone.substring(5));
        if (!isGroupInDb && phone.startsWith("55") && phone.length === 12) isGroupInDb = existingGroups.has("55" + phone.substring(2, 4) + "9" + phone.substring(4));

        return !isGroupInDb;
      });

      const removed = phoneList.length - filtered.length;
      setPhoneList(filtered);
      toast({ title: `${removed} grupos identificados e removidos.`, description: `Restam ${filtered.length} contatos válidos da lista original.` });
    } catch {
      toast({ variant: "destructive", title: "Erro ao filtrar grupos" });
    } finally {
      setIsFiltering(false);
    }
  };

  const handleValidateWhatsApp = async () => {
    if (!orgId || phoneList.length === 0) return;
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-api", {
        body: { action: "check_whatsapp", organization_id: orgId, phones: phoneList },
      });
      if (error) { toast({ variant: "destructive", title: "Erro ao validar números", description: String(error) }); return; }
      const invalid: string[] = data?.invalid || [];
      const valid: string[] = data?.valid || [];
      if (invalid.length > 0) { setInvalidNumbers(invalid); setShowInvalidDialog(true); }
      else {
        if (valid.length > 0) setPhoneList(valid);
        toast({ title: "Todos os números são válidos!", description: `${valid.length} números verificados no WhatsApp` });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na validação", description: err.message });
    } finally { setIsValidating(false); }
  };

  const handleConfirmRemoveInvalid = () => {
    const invalidSet = new Set(invalidNumbers);
    const newList = phoneList.filter(p => !invalidSet.has(p));
    setPhoneList(newList);
    toast({ title: `${invalidNumbers.length} números inválidos removidos`, description: `Restam ${newList.length} números válidos` });
    setInvalidNumbers([]);
    setShowInvalidDialog(false);
  };

  const fetchAllPaginated = async (buildQuery: () => any): Promise<any[]> => {
    const results: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const query = buildQuery();
      const { data } = await query.range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      results.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return results;
  };

  const resolveRecipients = async (): Promise<string[]> => {
    let raw: string[] = [];
    if (!orgId) return [];

    if (targetType === "list" || targetType === "saved_list") {
      raw = phoneList;
    } else if (targetType === "all") {
      const data = await fetchAllPaginated(() =>
        supabase.from("chats").select("phone").eq("organization_id", orgId).eq("is_group", false)
      );
      raw = [...new Set(data.map(c => c.phone))];
    } else if (targetType === "tags" && selectedTagIds.length > 0) {
      const data = await fetchAllPaginated(() =>
        supabase.from("chat_tags").select("chat_id, chats(phone)").eq("organization_id", orgId).in("tag_id", selectedTagIds)
      );
      raw = [...new Set(data.map((ct: any) => ct.chats?.phone).filter(Boolean))];
    } else if (targetType === "funnel" && selectedStageId) {
      const data = await fetchAllPaginated(() =>
        supabase.from("chat_funnel_stage").select("chat_id, chats(phone)").eq("organization_id", orgId).eq("stage_id", selectedStageId)
      );
      raw = [...new Set(data.map((cfs: any) => cfs.chats?.phone).filter(Boolean))];
    }

    // Globally ban known Evolution Whatsapp Group identifiers from entering the dispatcher thread
    return raw.filter(p => !(p.length > 14 && p.includes("g.us")));
  };

  const resolveExcludedRecipients = async (): Promise<string[]> => {
    if (!orgId || excludeTargetType === "none") return [];
    if (excludeTargetType === "saved_list" && excludeSelectedSavedListId) {
      const list = savedLists.find((l: any) => l.id === excludeSelectedSavedListId);
      return list?.phones || [];
    }
    if (excludeTargetType === "tags" && Array.isArray(excludeSelectedTagIds) && excludeSelectedTagIds.length > 0) {
      const data = await fetchAllPaginated(() => supabase.from("chat_tags").select("chat_id, chats(phone)").eq("organization_id", orgId).in("tag_id", excludeSelectedTagIds));
      return [...new Set(data.map((ct: any) => ct.chats?.phone).filter(Boolean))];
    }
    if (excludeTargetType === "funnel" && excludeSelectedStageId) {
      const data = await fetchAllPaginated(() => supabase.from("chat_funnel_stage").select("chat_id, chats(phone)").eq("organization_id", orgId).eq("stage_id", excludeSelectedStageId));
      return [...new Set(data.map((cfs: any) => cfs.chats?.phone).filter(Boolean))];
    }
    return [];
  };

  const handleVerifyExclusion = async () => {
    setIsFiltering(true);
    try {
      const targets = await resolveRecipients();
      const excluded = await resolveExcludedRecipients();
      const finalRecipients = targets.filter(t => !excluded.includes(t));
      setFinalPreviewList(finalRecipients);
      const finalCount = finalRecipients.length;
      toast({
        title: "Análise de Exclusão Concluída",
        description: `${targets.length} alvos iniciais.\n${excluded.length} números barrados.\n\nResultando em ${finalCount} leads válidos.`
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao verificar exclusões" });
    } finally {
      setIsFiltering(false);
    }
  };

  const resolvePhoneToChatId = async (phone: string, cache: Map<string, string>): Promise<string | null> => {
    if (cache.has(phone)) return cache.get(phone)!;
    if (!orgId) return null;
    const variations = [phone];
    if (phone.startsWith("55") && phone.length === 13) variations.push("55" + phone.substring(2, 4) + phone.substring(5));
    if (phone.startsWith("55") && phone.length === 12) variations.push("55" + phone.substring(2, 4) + "9" + phone.substring(4));

    const { data: existingChat } = await supabase
      .from("chats").select("id").eq("organization_id", orgId).in("phone", variations).limit(1).maybeSingle();

    if (existingChat) {
      cache.set(phone, existingChat.id);
      return existingChat.id;
    }
    const { data: newChat } = await supabase
      .from("chats").insert({ organization_id: orgId, phone, wa_name: phone, channel: "whatsapp" }).select("id").single();
    const chatId = newChat?.id || null;
    if (chatId) cache.set(phone, chatId);
    return chatId;
  };

  const handleApplyTemplate = (templateId: string) => {
    const t = templates.find((t: any) => t.id === templateId);
    if (!t) return;
    const config = parseTemplateConfig(t.content);
    const stepsToApply = (config.steps || [{ step_order: 1, message_type: 'text', content: t.content }])
      .map((s: any) => ({ ...s, id: s.id || crypto.randomUUID() }));
    setMessageSteps(stepsToApply);
    if (config.delay_seconds) setDelaySeconds(config.delay_seconds);
    if (config.delay_between_messages) setDelayBetweenMessages(config.delay_between_messages);
    if (config.auto_assign_tag) { setAutoAssignTag(true); setAutoAssignTagId(config.auto_assign_tag_id || ""); }
    if (config.auto_assign_funnel) { setAutoAssignFunnel(true); setAutoAssignFunnelId(config.auto_assign_funnel_id || ""); setAutoAssignStageId(config.auto_assign_stage_id || ""); }
  };

  const handleSaveDraft = async () => {
    if (!orgId || !campaignName.trim()) {
      toast({ variant: "destructive", title: "Preencha o nome da campanha" });
      return;
    }
    try {
      const recipients = targetType === "list" || targetType === "saved_list" ? phoneList : [];
      await supabase.from("broadcast_campaigns").insert({
        organization_id: orgId, name: campaignName, message_content: JSON.stringify(messageSteps),
        target_type: targetType, target_phones: recipients,
        target_tag_ids: selectedTagIds.length > 0 ? selectedTagIds : null,
        target_funnel_id: selectedFunnelId || null, target_stage_id: selectedStageId || null,
        target_all_base: targetType === "all", delay_seconds: delaySeconds,
        scheduled_at: scheduleEnabled && scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : null,
        total_recipients: recipients.length, status: "draft",
      });
      toast({ title: "Rascunho salvo com sucesso!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message });
    }
  };

  const handleRequestStart = () => {
    const hasContent = messageSteps.some(s => s.content?.trim() || s.file_url);
    const isValidAutomation = campaignActionType === "automation" && selectedAutomationId;

    if (!orgId || !campaignName.trim() || (!hasContent && !isValidAutomation)) {
      toast({ variant: "destructive", title: "Preencha todos os campos obrigatórios" });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleStartCampaign = async () => {
    setShowConfirmDialog(false);
    setIsSending(true);

    const chatIdCache = new Map<string, string>();

    try {
      const allTargets = await resolveRecipients();
      const excluded = await resolveExcludedRecipients();
      const recipients = allTargets.filter(t => !excluded.includes(t));

      if (recipients.length === 0) {
        toast({ variant: "destructive", title: "Nenhum destinatário encontrado (ou todos foram excluídos)" });
        setIsSending(false);
        return;
      }

      if (recipients.length > 500) {
        toast({ title: "⚠️ Lista grande detectada", description: `Enviando para ${recipients.length} destinatários.` });
      }

      if (channelType === "meta") {
        if (!selectedMetaTemplateId) {
          toast({ variant: "destructive", title: "Selecione um template aprovado da Meta" });
          setIsSending(false);
          return;
        }
        try {
          // Check if scheduling is enabled for Meta
          if (scheduleEnabled && scheduledDate && scheduledTime) {
            const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            await supabase.from("wa_official_campaigns").insert({
              organization_id: orgId!,
              name: campaignName,
              template_id: selectedMetaTemplateId,
              target_type: targetType,
              target_phones: recipients,
              delay_seconds: delaySeconds,
              total_recipients: recipients.length,
              status: "scheduled",
              scheduled_at: scheduledAt,
            });
            toast({ title: "Disparo Meta agendado com sucesso!", description: `Será enviado em ${scheduledDate} às ${scheduledTime}` });
            resetForm();
            return;
          }

          const { data: campaign, error: insertError } = await supabase.from("wa_official_campaigns").insert({
            organization_id: orgId!,
            name: campaignName,
            template_id: selectedMetaTemplateId,
            target_type: targetType,
            target_phones: recipients,
            delay_seconds: delaySeconds,
            total_recipients: recipients.length,
            status: "running",
            started_at: new Date().toISOString()
          }).select().single();

          if (insertError) throw insertError;

          const { data, error } = await supabase.functions.invoke("meta-send-campaign", {
            body: { campaign_id: campaign.id }
          });

          if (error) {
            await supabase.from("wa_official_campaigns").update({ status: 'failed' }).eq('id', campaign.id);
            throw error;
          }

          toast({ title: "Disparo Oficial Iniciado!", description: "Processando envio pela Meta API." });
          resetForm();
        } catch (metaErr: any) {
          toast({ variant: "destructive", title: "Erro no disparo Meta", description: metaErr.message });
        } finally {
          setIsSending(false);
        }
        return;
      }

      if (scheduleEnabled && scheduledDate && scheduledTime) {
        const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        await supabase.from("broadcast_campaigns").insert({
          organization_id: orgId!, name: campaignName, message_content: JSON.stringify(messageSteps),
          target_type: targetType, target_phones: recipients, target_tag_ids: selectedTagIds,
          target_funnel_id: selectedFunnelId || null, target_stage_id: selectedStageId || null,
          target_all_base: targetType === "all", delay_seconds: delaySeconds,
          scheduled_at: scheduledAt, total_recipients: recipients.length, status: "scheduled",
        });
        toast({ title: "Disparo agendado com sucesso!" });
        setIsSending(false);
        return;
      }

      const { data: campaign } = await supabase.from("broadcast_campaigns").insert({
        organization_id: orgId!, name: campaignName, message_content: JSON.stringify(messageSteps),
        target_type: targetType, target_phones: recipients, delay_seconds: delaySeconds,
        total_recipients: recipients.length, status: "pending", started_at: new Date().toISOString(),
      }).select().single();

      const payload = {
        campaignId: campaign.id,
        campaignName,
        recipients,
        messageSteps,
        campaignActionType,
        selectedAutomationId,
        autoAssignTag,
        autoAssignTagId,
        autoAssignFunnel,
        autoAssignFunnelId,
        autoAssignStageId,
        delaySeconds,
        delayBetweenMessages,
        sent: 0,
        failed: 0,
        status: 'running'
      };

      const event = new CustomEvent("startBroadcast", { detail: payload });
      window.dispatchEvent(event);

      toast({ title: "Lote Lançado!", description: "Seu disparo iniciou e rodará totalmente em background. Navegue livremente!" });
      resetForm();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setCampaignName("");
    setMessageSteps([{ id: crypto.randomUUID(), step_order: 1, message_type: 'text', content: '' }]);
    setPhoneList([]);
    setSelectedTagIds([]);
    setSelectedFunnelId("");
    setSelectedStageId("");
    setSelectedSavedListId("");
    setAutoAssignTag(false);
    setAutoAssignTagId("");
    setAutoAssignFunnel(false);
    setAutoAssignFunnelId("");
    setAutoAssignStageId("");
    setScheduleEnabled(false);
    setScheduledDate("");
    setScheduledTime("");
    setDelayBetweenMessages(1.5);
  };

  const recipientSummary = targetType === "list" || targetType === "saved_list"
    ? `${phoneList.length} destinatários`
    : targetType === "all" ? "Toda a base"
      : targetType === "tags" ? `${selectedTagIds.length} etiquetas selecionadas`
        : selectedStageId ? "Etapa de funil selecionada" : "Selecione os destinatários";

  return (
    <>
      <div className="space-y-5 pb-6">
        {/* Campaign config */}
        <AudienceSelectionCard
          campaignName={campaignName} setCampaignName={setCampaignName}
          targetType={targetType} setTargetType={setTargetType as any}
          setPhoneList={setPhoneList} setSelectedSavedListId={setSelectedSavedListId}
          loadingLists={loadingLists} savedLists={savedLists} handleLoadSavedList={handleLoadSavedList}
          selectedSavedListId={selectedSavedListId} phoneList={phoneList}
          listInputMode={listInputMode} setListInputMode={setListInputMode as any}
          phoneInput={phoneInput} setPhoneInput={setPhoneInput} handleAddPhones={handleAddPhones}
          fileInputRef={fileInputRef} handleFileUpload={handleFileUpload}
          handleValidateWhatsApp={handleValidateWhatsApp} isValidating={isValidating}
          handleFilterRegistered={handleFilterRegistered} handleRemoveGroups={handleRemoveGroups} isFiltering={isFiltering}
          removePhone={removePhone} loadingTags={loadingTags} tags={tags}
          selectedTagIds={selectedTagIds} setSelectedTagIds={setSelectedTagIds}
          loadingFunnels={loadingFunnels} funnels={funnels} selectedFunnelId={selectedFunnelId}
          setSelectedFunnelId={setSelectedFunnelId} stages={stages} selectedStageId={selectedStageId}
          setSelectedStageId={setSelectedStageId}
        />

        <AudienceExclusionCard
          targetType={excludeTargetType} setTargetType={setExcludeTargetType}
          loadingLists={loadingLists} savedLists={savedLists} selectedSavedListId={excludeSelectedSavedListId} setSelectedSavedListId={setExcludeSelectedSavedListId}
          loadingTags={loadingTags} tags={tags} selectedTagIds={excludeSelectedTagIds} setSelectedTagIds={setExcludeSelectedTagIds}
          loadingFunnels={loadingFunnels} funnels={funnels} selectedFunnelId={excludeSelectedFunnelId} setSelectedFunnelId={setExcludeSelectedFunnelId}
          stages={stages} selectedStageId={excludeSelectedStageId} setSelectedStageId={setExcludeSelectedStageId}
        />

        <Button variant="outline" className="w-full h-11 flex gap-2 border-dashed border-2 border-primary/30" onClick={handleVerifyExclusion} disabled={isFiltering}>
          {isFiltering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4 text-primary" />}
          <span className="font-semibold tracking-wide">Recalcular Audiência e Exclusões</span>
        </Button>

        {finalPreviewList !== null && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview de Disparo ({finalPreviewList.length} números)</CardTitle>
            </CardHeader>
            <CardContent>
              {finalPreviewList.length === 0 ? (
                <p className="text-sm text-destructive font-medium">Nenhum destinatário válido restou após as exclusões.</p>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
                  {finalPreviewList.slice(0, 100).map((p: string) => (
                    <Badge key={p} variant="secondary" className="bg-background/80 text-xs">{p}</Badge>
                  ))}
                  {finalPreviewList.length > 100 && <Badge variant="outline" className="bg-background/80">+{finalPreviewList.length - 100} mais</Badge>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Canal de Envio */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Canal de Disparo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex rounded-md border p-1 bg-muted/20">
              <Button
                variant={channelType === "vitta" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => { setChannelType("vitta"); setCampaignActionType("message"); }}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Vitta IA (Evolution Gratuita)
              </Button>
              <Button
                variant={channelType === "meta" ? "default" : "ghost"}
                className="flex-1"
                onClick={() => { setChannelType("meta"); setCampaignActionType("message"); }}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp Oficial (Meta API)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Type Toggle */}
        {channelType === "vitta" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ServerCog className="h-5 w-5 text-primary" />
                Ação de Disparo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex rounded-md border p-1 bg-muted/20">
                <Button
                  variant={campaignActionType === "message" ? "default" : "ghost"}
                  className="flex-1"
                  onClick={() => setCampaignActionType("message")}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Mensagens
                </Button>
                <Button
                  variant={campaignActionType === "automation" ? "default" : "ghost"}
                  className="flex-1"
                  onClick={() => setCampaignActionType("automation")}
                >
                  <GitBranch className="mr-2 h-4 w-4" />
                  Automação I.A
                </Button>
              </div>

              {campaignActionType === "automation" && (
                <div className="space-y-2 mt-4 p-4 border rounded-lg bg-primary/5 border-primary/20">
                  <Label className="flex items-center gap-2 font-semibold">
                    <GitBranch className="h-4 w-4 text-primary" />
                    Selecione a Automação
                  </Label>
                  <Select value={selectedAutomationId} onValueChange={setSelectedAutomationId}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Escolha uma automação ativa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAutomations?.map((auto: any) => (
                        <SelectItem key={auto.id} value={auto.id}>{auto.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    O sistema não enviará as mensagens pré-configuradas abaixo. Em vez disso, assim que a fila atingir o lead, ele será <strong>injetado diretamente no fluxo visual da automação selecionada</strong>. Ideal para Agentes I.A automáticos e funis complexos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className={campaignActionType === "automation" ? "opacity-30 pointer-events-none transition-opacity select-none" : "transition-opacity"} aria-hidden={campaignActionType === "automation"}>
          {/* Message */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mensagem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length > 0 && (
                <div>
                  <Label>Usar modelo salvo</Label>
                  <Select onValueChange={handleApplyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Selecionar modelo..." /></SelectTrigger>
                    <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">O modelo carregará mensagens, delays e ações pós-envio.</p>
                </div>
              )}
              {orgId && (
                <CommandStepEditor steps={messageSteps} onChange={setMessageSteps} organizationId={orgId} />
              )}
            </CardContent>
          </Card>

          {/* Meta Config block replaces CommandStepEditor when channelType is 'meta' */}
          {channelType === "meta" && (
            <Card className="border-primary/50 bg-primary/5 shadow-md">
              <CardHeader className="pb-3 border-b border-primary/20 bg-background/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Template Oficial Aprovado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Selecione o Modelo da Meta</Label>
                <Select value={selectedMetaTemplateId} onValueChange={setSelectedMetaTemplateId}>
                  <SelectTrigger className="bg-background shadow-sm h-11 border-primary/30">
                    <SelectValue placeholder="Escolha um template verificado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {metaTemplates.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{t.name}</span>
                          <Badge variant="outline" className="text-[9px] uppercase">{t.language}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMetaTemplateId && (
                  <div className="bg-background/80 p-4 rounded-xl border border-primary/10 shadow-sm relative overflow-hidden">
                    <span className="absolute top-2 right-2 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Verificado
                    </span>
                    {(() => {
                      const t = metaTemplates.find((t: any) => t.id === selectedMetaTemplateId);
                      const bodyComponent = (t?.components as any[])?.find(c => c.type === 'BODY' || c.type === 'body');
                      return <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed mt-4">{bodyComponent?.text || "Geração de layout indisponível."}</p>;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className={channelType === "meta" ? "hidden" : ""}>
            {/* Post Action (tags/funnel) — hidden for Meta */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Ações Pós-Envio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">Atribuir automaticamente etiqueta ou etapa de funil a cada lead que receber a mensagem.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={autoAssignTag} onCheckedChange={setAutoAssignTag} />
                    <Label>Atribuir etiqueta automaticamente</Label>
                  </div>
                  {autoAssignTag && (
                    <Select value={autoAssignTagId} onValueChange={setAutoAssignTagId}>
                      <SelectTrigger><SelectValue placeholder="Selecione a etiqueta" /></SelectTrigger>
                      <SelectContent>
                        {tags?.map((tag: any) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={autoAssignFunnel} onCheckedChange={setAutoAssignFunnel} />
                    <Label>Mover para etapa de funil automaticamente</Label>
                  </div>
                  {autoAssignFunnel && (
                    <>
                      <Select value={autoAssignFunnelId} onValueChange={(v) => { setAutoAssignFunnelId(v); setAutoAssignStageId(""); }}>
                        <SelectTrigger><SelectValue placeholder="Selecione o funil" /></SelectTrigger>
                        <SelectContent>{funnels?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {autoAssignFunnelId && (
                        <Select value={autoAssignStageId} onValueChange={setAutoAssignStageId}>
                          <SelectTrigger><SelectValue placeholder="Selecione a etapa" /></SelectTrigger>
                          <SelectContent>{autoAssignStages?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Scheduling & Delay — visible for ALL channels, OUTSIDE the automation block */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Agendamento & Delay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Delay entre destinatários (s)</Label>
                <Input type="number" min={3} max={300} value={delaySeconds} onChange={e => setDelaySeconds(Math.max(3, Number(e.target.value)))} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Mínimo 3s</p>
              </div>
              <div>
                <Label>Delay entre mensagens (s)</Label>
                <Input type="number" min={0.5} max={30} step={0.5} value={delayBetweenMessages} onChange={e => setDelayBetweenMessages(Math.max(0.5, Number(e.target.value)))} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Entre etapas da sequência</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
              <Label>Agendar envio</Label>
            </div>
            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="mt-1" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {recipientSummary}
              </div>
              {(autoAssignTag && autoAssignTagId) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  Etiqueta: {tags.find(t => t.id === autoAssignTagId)?.name || "—"}
                </div>
              )}
              {(autoAssignFunnel && autoAssignStageId) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  Funil: {funnels.find(f => f.id === autoAssignFunnelId)?.name} → {autoAssignStages.find(s => s.id === autoAssignStageId)?.name}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {scheduleEnabled && scheduledDate ? `Agendado: ${scheduledDate} ${scheduledTime}` : `Envio imediato • ${delaySeconds}s entre destinatários • ${delayBetweenMessages}s entre mensagens`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleSaveDraft} disabled={isSending || !campaignName.trim()}>
                  <Save className="h-4 w-4 mr-2" /> Salvar Rascunho
                </Button>
                <Button className="flex-1" onClick={handleRequestStart} disabled={isSending || !campaignName.trim() || (!messageSteps.some(s => s.content?.trim() || s.file_url) && !(campaignActionType === "automation" && selectedAutomationId))}>
                  {isSending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando Lote...</>
                  ) : scheduleEnabled ? (
                    <><Clock className="h-4 w-4 mr-2" /> Agendar Disparo</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Iniciar Disparo Background</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="hidden lg:flex fixed top-16 right-0 w-[50%] h-[calc(100vh-4rem)] flex-col items-center justify-center pointer-events-none z-10">
        <div className="w-full flex flex-col items-center justify-center h-[calc(100vh-6rem)] pointer-events-none">
          <MessagePreview
            steps={
              channelType === "meta" && selectedMetaTemplateId
                ? [{ id: 'meta-preview', step_order: 1, message_type: "text" as const, content: ((metaTemplates.find((t: any) => t.id === selectedMetaTemplateId)?.components as any[])?.find(c => c.type === 'BODY' || c.type === 'body'))?.text || "Template Meta Oficial" }]
                : messageSteps
            }
            automationMode={campaignActionType === "automation"}
            automationName={availableAutomations?.find(a => a.id === selectedAutomationId)?.name}
          />
          {isSending && (
            <Card className="border-primary/30 bg-primary/5 mt-4 max-w-[340px] shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Preparando Lote de Contatos...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">O sistema está resolvendo a infraestrutura de contatos. Seu disparo iniciará flutuando no AppShell de segundo plano em breve.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirm start dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirmar envio de disparo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Você está prestes a enviar <strong>{messageSteps.length} mensagem(ns)</strong> para os destinatários selecionados.</p>
              <p className="text-sm">Campanha: <strong>{campaignName}</strong></p>
              <p className="text-sm">Destinatários: <strong>{recipientSummary}</strong></p>
              <p className="text-sm">Delay: <strong>{delaySeconds}s</strong> entre destinatários, <strong>{delayBetweenMessages}s</strong> entre mensagens</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartCampaign}>
              <Send className="h-4 w-4 mr-2" /> Confirmar e Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invalid numbers dialog */}
      <AlertDialog open={showInvalidDialog} onOpenChange={setShowInvalidDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {invalidNumbers.length} números inválidos encontrados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os seguintes números não possuem WhatsApp ativo. Deseja removê-los da lista?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 overflow-y-auto space-y-1 my-2">
            {invalidNumbers.map(num => (
              <div key={num} className="flex items-center gap-2 text-sm text-muted-foreground p-1.5 bg-muted rounded">
                <XCircle className="h-3 w-3 text-destructive shrink-0" /> {num}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter na lista</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveInvalid} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover inválidos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
