'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, User, Phone, Mail, Building2, Calendar, MapPin, Briefcase, Hash } from 'lucide-react';

interface TemplateCategory {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  templateCount?: number;
}

interface Template {
  id: string;
  name: string;
  content: string;
  categoryId?: string | null;
  category?: TemplateCategory | null;
  variables: string[];
  usageCount: number;
  active: boolean;
  isPredefined: boolean;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  categories: TemplateCategory[];
  onSuccess: () => void;
  onCategoryCreated?: () => void;
}

const QUICK_VARIABLES = [
  { name: 'name', label: 'Nome', icon: User },
  { name: 'phone', label: 'Telefone', icon: Phone },
  { name: 'email', label: 'Email', icon: Mail },
  { name: 'company', label: 'Empresa', icon: Building2 },
  { name: 'date', label: 'Data', icon: Calendar },
  { name: 'city', label: 'Cidade', icon: MapPin },
  { name: 'position', label: 'Cargo', icon: Briefcase },
  { name: 'id', label: 'ID', icon: Hash },
];

const SAMPLE_DATA = {
  name: 'João Silva',
  phone: '(11) 99999-9999',
  email: 'joao@exemplo.com',
  company: 'Exemplo Ltda',
  date: '15/11/2025',
  city: 'São Paulo',
  position: 'Gerente de Vendas',
  id: '12345',
};

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  categories,
  onSuccess,
  onCategoryCreated,
}: TemplateDialogProps) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [loading, setLoading] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
      setCategoryId(template.categoryId || 'none');
    } else {
      setName('');
      setContent('');
      setCategoryId('none');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
  }, [template, open]);

  const detectedVariables = useMemo(() => {
    const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variableName = match[1];
      if (variableName && !variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }, [content]);

  const previewContent = useMemo(() => {
    let preview = content;
    Object.entries(SAMPLE_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      preview = preview.replace(regex, value);
    });
    return preview;
  }, [content]);

  const insertVariable = (variable: string) => {
    const cursorPosition = (document.getElementById('template-content') as HTMLTextAreaElement)?.selectionStart || content.length;
    const beforeCursor = content.substring(0, cursorPosition);
    const afterCursor = content.substring(cursorPosition);
    setContent(`${beforeCursor}{{${variable}}}${afterCursor}`);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      notify.error('Erro de validação', 'O nome da categoria é obrigatório.');
      return;
    }

    setCreatingCategory(true);

    try {
      const response = await fetch('/api/v1/templates/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar categoria');
      }

      const data = await response.json();

      notify.success('Categoria Criada!', `A categoria "${newCategoryName}" foi criada com sucesso.`);

      setCategoryId(data.id);
      setShowNewCategory(false);
      setNewCategoryName('');
      onCategoryCreated?.();
    } catch (error) {
      notify.error('Erro ao Criar Categoria', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      notify.error('Erro de validação', 'O nome do template é obrigatório.');
      return;
    }

    if (!content.trim()) {
      notify.error('Erro de validação', 'O conteúdo do template é obrigatório.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name,
        content,
        categoryId: categoryId && categoryId !== 'none' ? categoryId : null,
      };

      const response = await fetch(
        template ? `/api/v1/templates/${template.id}` : '/api/v1/templates',
        {
          method: template ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar template');
      }

      notify.success(template ? 'Template Atualizado!' : 'Template Criado!', `O template "${name}" foi salvo com sucesso.`);

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      notify.error('Erro ao Salvar', error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Editar Template' : 'Criar Novo Template'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome do Template *</Label>
              <Input
                id="template-name"
                placeholder="Ex: Boas-vindas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">Categoria</Label>
              {!showNewCategory ? (
                <div className="flex gap-2">
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger id="template-category">
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon && <span className="mr-1">{cat.icon}</span>}
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewCategory(true)}
                  >
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory}
                  >
                    {creatingCategory ? 'Criando...' : 'Criar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewCategory(false);
                      setNewCategoryName('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Variáveis Rápidas</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_VARIABLES.map((variable) => (
                <Button
                  key={variable.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariable(variable.name)}
                  className="gap-1"
                >
                  <variable.icon className="h-3 w-3" />
                  {`{{${variable.name}}}`}
                </Button>
              ))}
            </div>
          </div>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="space-y-2">
              <Label htmlFor="template-content">Conteúdo *</Label>
              <Textarea
                id="template-content"
                placeholder="Digite o conteúdo do template. Use {{variavel}} para inserir variáveis dinâmicas."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                required
              />
              {detectedVariables.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Variáveis Detectadas:</Label>
                  <div className="flex flex-wrap gap-1">
                    {detectedVariables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="font-mono text-xs">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="preview" className="space-y-2">
              <Label>Preview com Dados de Exemplo:</Label>
              <div className="border rounded-lg p-4 bg-muted/50 min-h-[200px] whitespace-pre-wrap">
                {previewContent || (
                  <span className="text-muted-foreground">
                    O preview aparecerá aqui quando você adicionar conteúdo...
                  </span>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : template ? 'Atualizar' : 'Criar Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
