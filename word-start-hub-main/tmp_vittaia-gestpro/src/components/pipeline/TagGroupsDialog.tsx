import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X, Check, FolderPlus, Folder, Plus } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagGroup {
  id: string;
  name: string;
  tags: Tag[];
}

interface TagGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupsUpdated?: () => void;
}

const TagGroupsDialog = ({ open, onOpenChange, onGroupsUpdated }: TagGroupsDialogProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (open && currentOrganization?.id) {
      fetchTags();
      fetchGroups();
    }
  }, [open, currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await supabase
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", currentOrganization.id)
      .order("order_position", { ascending: true });
    setTags(data || []);
  };

  const fetchGroups = async () => {
    if (!currentOrganization?.id) return;
    const { data: groupsData } = await supabase
      .from("tag_groups")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("created_at", { ascending: true });

    if (!groupsData) { setGroups([]); return; }

    const { data: membersData } = await supabase
      .from("tag_group_members")
      .select("group_id, tag_id")
      .eq("organization_id", currentOrganization.id);

    const { data: allTags } = await supabase
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", currentOrganization.id);

    const tagsMap = new Map((allTags || []).map((t: Tag) => [t.id, t]));

    const result: TagGroup[] = groupsData.map((g: any) => {
      const memberTagIds = (membersData || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.tag_id);
      return {
        id: g.id,
        name: g.name,
        tags: memberTagIds.map((tid: string) => tagsMap.get(tid)).filter(Boolean) as Tag[],
      };
    });
    setGroups(result);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentOrganization?.id) return;
    const { error } = await supabase.from("tag_groups").insert({ name: newGroupName, organization_id: currentOrganization.id });
    if (error) { toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Grupo criado" });
    setNewGroupName("");
    fetchGroups();
    onGroupsUpdated?.();
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Excluir este grupo de etiquetas?")) return;
    const { error } = await supabase.from("tag_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Grupo excluído" });
    fetchGroups();
    onGroupsUpdated?.();
  };

  const handleUpdateGroupName = async (groupId: string) => {
    if (!editGroupName.trim()) return;
    const { error } = await supabase.from("tag_groups").update({ name: editGroupName }).eq("id", groupId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEditingGroupId(null);
    fetchGroups();
    onGroupsUpdated?.();
  };

  const handleAddTagToGroup = async (groupId: string, tagId: string) => {
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("tag_group_members").insert({
      group_id: groupId, tag_id: tagId, organization_id: currentOrganization.id,
    });
    if (error) {
      if (error.code === '23505') { toast({ title: "Tag já está neste grupo" }); return; }
      toast({ title: "Erro", description: error.message, variant: "destructive" }); return;
    }
    fetchGroups();
    onGroupsUpdated?.();
  };

  const handleRemoveTagFromGroup = async (groupId: string, tagId: string) => {
    const { error } = await supabase.from("tag_group_members").delete().eq("group_id", groupId).eq("tag_id", tagId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchGroups();
    onGroupsUpdated?.();
  };

  const getAvailableTagsForGroup = (group: TagGroup) => {
    const groupTagIds = new Set(group.tags.map(t => t.id));
    return tags.filter(t => !groupTagIds.has(t.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📁 Grupos de Etiquetas</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-2">
            <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome do grupo..." className="flex-1" />
            <Button onClick={handleCreateGroup} size="sm" className="gap-1.5 shrink-0">
              <FolderPlus className="h-4 w-4" /> Criar
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum grupo criado ainda</p>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {groups.map((group) => (
                <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-3">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                    {editingGroupId === group.id ? (
                      <div className="flex items-center gap-1 flex-1 py-2">
                        <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="h-8 flex-1" />
                        <Button size="icon" variant="ghost" onClick={() => handleUpdateGroupName(group.id)} className="h-8 w-8"><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingGroupId(null)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <AccordionTrigger className="flex-1 hover:no-underline">
                          <span className="text-sm font-medium">{group.name} ({group.tags.length})</span>
                        </AccordionTrigger>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }} className="h-8 w-8 shrink-0">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteGroup(group.id)} className="h-8 w-8 shrink-0 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                  <AccordionContent>
                    <div className="space-y-3 pt-1">
                      {group.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {group.tags.map(tag => (
                            <span key={tag.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-card">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                              <button onClick={() => handleRemoveTagFromGroup(group.id, tag.id)} className="ml-0.5 hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {getAvailableTagsForGroup(group).length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Adicionar tags:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {getAvailableTagsForGroup(group).map(tag => (
                              <button key={tag.id} onClick={() => handleAddTagToGroup(group.id, tag.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-dashed hover:border-primary hover:bg-primary/5 transition-colors">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                                <Plus className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TagGroupsDialog;
