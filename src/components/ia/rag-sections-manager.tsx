'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Loader2, Plus, Edit, Trash2, Eye, Code } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface PromptSection {
  id: string;
  personaId: string;
  sectionName: string;
  content: string;
  language: string;
  priority: number;
  tags: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RagSectionsManagerProps {
  personaId: string;
}

export function RagSectionsManager({ personaId }: RagSectionsManagerProps) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [sections, setSections] = useState<PromptSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<PromptSection | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    sectionName: '',
    content: '',
    language: 'all',
    priority: 50,
    tags: '',
  });

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/ia/personas/${personaId}/sections`);
      if (!response.ok) throw new Error('Falha ao carregar seções');
      const data = await response.json();
      setSections(data);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, [personaId]);

  const handleAdd = () => {
    setFormData({
      sectionName: '',
      content: '',
      language: 'all',
      priority: 50,
      tags: '',
    });
    setEditingSection(null);
    setIsAddDialogOpen(true);
  };

  const handleEdit = (section: PromptSection) => {
    setFormData({
      sectionName: section.sectionName,
      content: section.content,
      language: section.language,
      priority: section.priority,
      tags: section.tags?.join(', ') || '',
    });
    setEditingSection(section);
    setIsAddDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t);

      const payload = {
        sectionName: formData.sectionName,
        content: formData.content,
        language: formData.language,
        priority: formData.priority,
        tags,
      };

      const url = editingSection
        ? `/api/v1/ia/personas/${personaId}/sections/${editingSection.id}`
        : `/api/v1/ia/personas/${personaId}/sections`;
      const method = editingSection ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Falha ao salvar seção');

      notify.success('Sucesso!', editingSection
          ? 'Seção atualizada com sucesso'
          : 'Seção criada com sucesso');

      setIsAddDialogOpen(false);
      fetchSections();
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sectionToDelete) return;

    try {
      const response = await fetch(
        `/api/v1/ia/personas/${personaId}/sections/${sectionToDelete}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Falha ao deletar seção');

      notify.success('Sucesso!', 'Seção removida com sucesso');

      setIsDeleteDialogOpen(false);
      setSectionToDelete(null);
      fetchSections();
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    }
  };

  const handlePreview = () => {
    const sortedSections = [...sections].sort((a, b) => b.priority - a.priority);
    const preview = sortedSections
      .map(
        (s) =>
          `// ${s.sectionName} (${s.language}) - Prioridade: ${s.priority}\n${s.content}\n`
      )
      .join('\n---\n\n');
    setPreviewContent(preview);
    setIsPreviewOpen(true);
  };

  const languages = sections.map((s) => s.language).filter((l, i, arr) => arr.indexOf(l) === i);

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      pt: 'bg-green-500',
      es: 'bg-yellow-500',
      en: 'bg-blue-500',
      all: 'bg-gray-500',
    };
    return colors[lang] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Seções RAG (Prompts Modulares)</CardTitle>
          <CardDescription>
            Gerencie as seções modulares do prompt deste agente. Cada seção pode ter idioma,
            prioridade e tags específicas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="outline">
                {sections.length} {sections.length === 1 ? 'seção' : 'seções'}
              </Badge>
              {languages.length > 0 && (
                <Badge variant="outline">
                  {languages.length} {languages.length === 1 ? 'idioma' : 'idiomas'}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" />
                Preview do Prompt
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Seção
              </Button>
            </div>
          </div>

          {sections.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Code className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma seção encontrada</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Adicione seções modulares para otimizar o prompt deste agente
              </p>
              <Button className="mt-4" onClick={handleAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Seção
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <Card key={section.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getLanguageColor(section.language)}>
                            {section.language.toUpperCase()}
                          </Badge>
                          <h4 className="font-semibold">{section.sectionName}</h4>
                          <Badge variant="outline">Prioridade: {section.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {section.content}
                        </p>
                        {section.tags && section.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {section.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(section)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSectionToDelete(section.id);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Editar Seção' : 'Adicionar Nova Seção'}
            </DialogTitle>
            <DialogDescription>
              Defina o nome, idioma, prioridade e conteúdo da seção modular.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sectionName">Nome da Seção</Label>
              <Input
                id="sectionName"
                value={formData.sectionName}
                onChange={(e) =>
                  setFormData({ ...formData, sectionName: e.target.value })
                }
                placeholder="Ex: introdução_empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={formData.language}
                  onValueChange={(value) => setFormData({ ...formData, language: value })}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os idiomas</SelectItem>
                    <SelectItem value="pt">Português (pt)</SelectItem>
                    <SelectItem value="es">Espanhol (es)</SelectItem>
                    <SelectItem value="en">Inglês (en)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade: {formData.priority}</Label>
                <Slider
                  id="priority"
                  min={0}
                  max={100}
                  step={5}
                  value={[formData.priority]}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value[0] ?? 50 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Ex: core, introduction, main_content"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Digite o conteúdo desta seção..."
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Seção?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A seção será permanentemente removida do
              sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Sim, Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview do Prompt Final</DialogTitle>
            <DialogDescription>
              Visualização de como as seções serão montadas (ordenadas por prioridade)
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-lg max-h-[60vh] overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap">{previewContent}</pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
