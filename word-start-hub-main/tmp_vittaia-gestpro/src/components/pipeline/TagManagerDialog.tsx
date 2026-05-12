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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CompactColorPicker from "./CompactColorPicker";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X, Check, FolderPlus, Folder, Plus } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { deleteTagWithCleanup } from "@/lib/tag-delete";
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

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTagsUpdated?: () => void;
}

const TagManagerDialog = ({ open, onOpenChange, onTagsUpdated }: TagManagerDialogProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
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
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .order("order_position", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar tags", description: error.message, variant: "destructive" });
      return;
    }
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

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para a tag", variant: "destructive" });
      return;
    }
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("tags").insert({
      name: newTagName, color: newTagColor, order_position: tags.length, organization_id: currentOrganization.id,
    });
    if (error) { toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tag criada com sucesso" });
    setNewTagName(""); setNewTagColor("#3B82F6");
    fetchTags(); fetchGroups(); onTagsUpdated?.();
  };

  const handleStartEdit = (tag: Tag) => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("tags").update({ name: editName, color: editColor }).eq("id", editingId);
    if (error) { toast({ title: "Erro ao atualizar tag", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tag atualizada" });
    setEditingId(null); fetchTags(); fetchGroups(); onTagsUpdated?.();
  };

  const handleDelete = async (id: string) => {
    if (!currentOrganization?.id) return;
    if (!confirm("Tem certeza que deseja excluir esta tag?")) return;
    try {
      await deleteTagWithCleanup({ supabase, tagId: id, organizationId: currentOrganization.id });
      toast({ title: "Tag excluída" });
      fetchTags(); fetchGroups(); onTagsUpdated?.();
    } catch (error: any) {
      toast({ title: "Erro ao excluir tag", description: error?.message, variant: "destructive" });
    }
  };

  // Group operations
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !currentOrganization?.id) return;
    const { error } = await supabase.from("tag_groups").insert({ name: newGroupName, organization_id: currentOrganization.id });
    if (error) { toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Grupo criado" });
    setNewGroupName("");
    fetchGroups();
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Excluir este grupo de etiquetas?")) return;
    const { error } = await supabase.from("tag_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Grupo excluído" });
    fetchGroups();
  };

  const handleUpdateGroupName = async (groupId: string) => {
    if (!editGroupName.trim()) return;
    const { error } = await supabase.from("tag_groups").update({ name: editGroupName }).eq("id", groupId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setEditingGroupId(null);
    fetchGroups();
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
  };

  const handleRemoveTagFromGroup = async (groupId: string, tagId: string) => {
    const { error } = await supabase.from("tag_group_members").delete().eq("group_id", groupId).eq("tag_id", tagId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchGroups();
  };

  const getAvailableTagsForGroup = (group: TagGroup) => {
    const groupTagIds = new Set(group.tags.map(t => t.id));
    return tags.filter(t => !groupTagIds.has(t.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🏷️ Gerenciar Tags</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="tags" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="groups">Grupos</TabsTrigger>
          </TabsList>

          <TabsContent value="tags" className="space-y-6 mt-4">
            {/* Create tag */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="tag-name">Nome da Tag</Label>
                <Input id="tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ex: Lead Quente" className="mt-1.5" />
              </div>
              <CompactColorPicker value={newTagColor} onChange={setNewTagColor} />
              <Button onClick={handleCreateTag} className="w-full">+ Criar Tag</Button>
            </div>

            {/* Tag list */}
            <div>
              <h3 className="font-semibold mb-3">Tags Existentes</h3>
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                    {editingId === tag.id ? (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: editColor }} />
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8" />
                        <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8"><Check className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        <Button size="icon" variant="ghost" onClick={() => handleStartEdit(tag)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(tag.id)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6 mt-4">
            {/* Create group */}
            <div className="flex gap-2">
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nome do grupo..." className="flex-1" />
              <Button onClick={handleCreateGroup} size="sm" className="gap-1.5 shrink-0">
                <FolderPlus className="h-4 w-4" /> Criar
              </Button>
            </div>

            {/* Groups list */}
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
                        {/* Tags in group */}
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

                        {/* Add tags */}
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default TagManagerDialog;
