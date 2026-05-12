import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CompactColorPicker from "./CompactColorPicker";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X, Check, Plus, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { deleteTagWithCleanup } from "@/lib/tag-delete";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagGroup {
  id: string;
  name: string;
  tag_ids: string[];
}

interface InlineTagManagerProps {
  onTagsUpdated?: () => void;
}

const InlineTagManager = ({ onTagsUpdated }: InlineTagManagerProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) { fetchTags(); fetchGroups(); }
  }, [currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    const { data, error } = await supabase.from("tags").select("*").eq("organization_id", currentOrganization.id).order("order_position", { ascending: true });
    if (error) { toast({ title: "Erro ao carregar tags", description: error.message, variant: "destructive" }); return; }
    setTags(data || []);
  };

  const fetchGroups = async () => {
    if (!currentOrganization?.id) return;
    const { data: groupsData } = await supabase.from("tag_groups").select("*").eq("organization_id", currentOrganization.id);
    if (!groupsData) { setGroups([]); return; }
    const { data: membersData } = await supabase.from("tag_group_members").select("group_id, tag_id").eq("organization_id", currentOrganization.id);
    setGroups(groupsData.map((g: any) => ({
      id: g.id,
      name: g.name,
      tag_ids: (membersData || []).filter((m: any) => m.group_id === g.id).map((m: any) => m.tag_id),
    })));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    if (!currentOrganization?.id) return;
    const { error } = await supabase.from("tags").insert({ name: newTagName, color: newTagColor, order_position: tags.length, organization_id: currentOrganization.id });
    if (error) { toast({ title: "Erro ao criar tag", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tag criada com sucesso" });
    setNewTagName(""); setNewTagColor("#3B82F6"); setShowCreateForm(false);
    fetchTags(); fetchGroups(); onTagsUpdated?.();
  };

  const handleStartEdit = (tag: Tag) => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const { error } = await supabase.from("tags").update({ name: editName, color: editColor }).eq("id", editingId);
    if (error) { toast({ title: "Erro ao atualizar tag", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Tag atualizada" });
    setEditingId(null); fetchTags(); onTagsUpdated?.();
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

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const groupedTagIds = new Set(groups.flatMap(g => g.tag_ids));
  const ungroupedTags = tags.filter(t => !groupedTagIds.has(t.id));

  const renderTagRow = (tag: Tag) => (
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
          <span className="flex-1 text-sm font-medium truncate">{tag.name}</span>
          <Button size="icon" variant="ghost" onClick={() => handleStartEdit(tag)} className="h-8 w-8 shrink-0"><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => handleDelete(tag.id)} className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">🏷️ Etiquetas</h2>
        <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm" variant={showCreateForm ? "secondary" : "default"} className="gap-1.5">
          {showCreateForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreateForm ? "Cancelar" : "Nova Tag"}
        </Button>
      </div>

      {showCreateForm && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border border-dashed border-border animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div>
            <Label htmlFor="tag-name">Nome da Tag</Label>
            <Input id="tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Ex: Lead Quente" className="mt-1.5" />
          </div>
          <CompactColorPicker value={newTagColor} onChange={setNewTagColor} />
          <Button onClick={handleCreateTag} className="w-full">Criar Tag</Button>
        </div>
      )}

      <div className="space-y-3">
        {/* Groups as folders */}
        {groups.map(group => {
          const isExpanded = expandedGroups.has(group.id);
          const groupTags = group.tag_ids.map(tid => tags.find(t => t.id === tid)).filter(Boolean) as Tag[];
          if (groupTags.length === 0) return null;

          return (
            <div key={group.id} className="rounded-lg border bg-muted/30 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroupExpanded(group.id)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <FolderOpen className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-xs text-muted-foreground">({groupTags.length})</span>
              </button>
              {isExpanded && (
                <div className="grid gap-2 sm:grid-cols-2 px-3 pb-3 animate-in fade-in-0 slide-in-from-top-1 duration-150">
                  {groupTags.map(tag => renderTagRow(tag))}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped tags */}
        {ungroupedTags.length > 0 && (
          <div>
            {groups.length > 0 && <p className="text-xs text-muted-foreground mb-2">Sem grupo:</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {ungroupedTags.map(tag => renderTagRow(tag))}
            </div>
          </div>
        )}

        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tag criada ainda</p>
        )}
      </div>
    </div>
  );
};

export default InlineTagManager;
