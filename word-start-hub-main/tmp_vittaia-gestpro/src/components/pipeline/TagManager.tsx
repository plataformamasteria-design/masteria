import { useState, useEffect } from "react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Plus, Trash2, Edit, Save, X } from "lucide-react";
import { HexColorPicker } from "react-colorful";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteTagWithCleanup } from "@/lib/tag-delete";

interface Tag {
  id: string;
  name: string;
  color: string;
  icon: string;
  order_position: number;
}

const ICON_OPTIONS = [
  "Tag", "Snowflake", "Coffee", "Calendar", "CheckCircle", "Star", 
  "Heart", "Flag", "TrendingUp", "Users", "Phone", "Mail"
];

const TagManager = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState({ name: "", color: "#3B82F6", icon: "Tag" });
  const [editTag, setEditTag] = useState<Partial<Tag>>({});
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTags();
    }
  }, [currentOrganization?.id]);

  const fetchTags = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('order_position', { ascending: true });

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
      toast({
        title: "Erro ao carregar tags",
        description: "Não foi possível carregar as tags.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTag.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe o nome da tag.",
        variant: "destructive",
      });
      return;
    }

    if (!currentOrganization?.id) return;

    try {
      const { error } = await supabase
        .from('tags')
        .insert({
          name: newTag.name,
          color: newTag.color,
          icon: newTag.icon,
          order_position: tags.length,
          organization_id: currentOrganization.id,
        });

      if (error) throw error;

      toast({
        title: "Tag criada!",
        description: `Tag "${newTag.name}" criada com sucesso.`,
      });

      setNewTag({ name: "", color: "#3B82F6", icon: "Tag" });
      fetchTags();
    } catch (error) {
      console.error('Error creating tag:', error);
      toast({
        title: "Erro ao criar tag",
        description: "Não foi possível criar a tag.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tags')
        .update(editTag)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Tag atualizada!",
        description: "Tag atualizada com sucesso.",
      });

      setEditingId(null);
      setEditTag({});
      fetchTags();
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: "Erro ao atualizar tag",
        description: "Não foi possível atualizar a tag.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta tag? Isso também removerá a tag de todos os leads e sequências de follow-up.")) return;
    if (!currentOrganization?.id) return;

    try {
      await deleteTagWithCleanup({ supabase, tagId: id, organizationId: currentOrganization.id });

      toast({
        title: "Tag excluída!",
        description: "Tag excluída com sucesso.",
      });

      fetchTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast({
        title: "Erro ao excluir tag",
        description: "Não foi possível excluir a tag.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando tags...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Tag</CardTitle>
          <CardDescription>Adicione uma nova etiqueta para organizar seus leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Ex: Lead Quente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Select value={newTag.icon} onValueChange={(value) => setNewTag({ ...newTag, icon: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-4 items-start">
              <HexColorPicker color={newTag.color} onChange={(color) => setNewTag({ ...newTag, color })} />
              <div 
                className="w-20 h-20 rounded-lg border-2 border-border"
                style={{ backgroundColor: newTag.color }}
              />
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Criar Tag
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags Existentes</CardTitle>
          <CardDescription>Gerencie suas etiquetas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {editingId === tag.id ? (
                  <>
                    <Input
                      value={editTag.name || tag.name}
                      onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                      className="flex-1"
                    />
                    <HexColorPicker 
                      color={editTag.color || tag.color} 
                      onChange={(color) => setEditTag({ ...editTag, color })} 
                    />
                    <Button size="icon" variant="outline" onClick={() => handleUpdate(tag.id)}>
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div 
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 font-medium">{tag.name}</span>
                    <span className="text-sm text-muted-foreground">{tag.icon}</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => {
                        setEditingId(tag.id);
                        setEditTag(tag);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TagManager;
