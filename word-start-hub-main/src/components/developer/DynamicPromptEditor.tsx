import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Save, FileText, Plus, Trash2, Edit2, X, Check, GripVertical, AlertCircle, Sparkles, ArrowLeft, Copy, Eye, EyeOff, Wand2, ChevronDown, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PromptGeneratorAssistant } from "./PromptGeneratorAssistant";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PromptField {
  key: string;
  value: string;
  id: string;
}

interface PromptRecord {
  id: string;
  name: string;
  description: string;
  fields: PromptField[];
  created_at: string;
  updated_at: string;
}

const SUGGESTED_FIELDS = [
  { key: "Persona", placeholder: "Defina a personalidade e tom de voz do agente..." },
  { key: "Objetivo", placeholder: "Qual é a missão principal deste agente? (ex: qualificar leads, agendar consultas...)" },
  { key: "Instruções", placeholder: "Regras e diretrizes que o agente deve seguir..." },
  { key: "Contexto", placeholder: "Informações sobre o negócio, produtos ou serviços..." },
  { key: "Tom de Voz", placeholder: "Como o agente deve se comunicar (formal, casual, etc)..." },
  { key: "Restrições", placeholder: "O que o agente NÃO deve fazer ou falar..." },
  { key: "Base de Conhecimento", placeholder: "Dados, FAQs e informações que o agente pode consultar..." },
  { key: "Roteador de Cenário", placeholder: "Classificações internas e cenários de atendimento por tipo de serviço..." },
  { key: "Estrutura de Atendimento", placeholder: "Etapas sequenciais do fluxo de conversa (ex: saudação → triagem → oferta → encaminhamento)..." },
  { key: "Regras de Mensagem", placeholder: "Limites de caracteres, emojis permitidos, frequência de mensagens..." },
  { key: "Empatia e Contingência", placeholder: "Como reagir a situações emocionais, emergências ou reclamações..." },
  { key: "Exemplos de Conversa", placeholder: "Amostras de diálogos ideais para o agente seguir como referência..." },
];

interface SortableFieldProps {
  field: PromptField;
  index: number;
  isEditing: boolean;
  newKeyName: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onKeyNameChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onDelete: () => void;
}

const SortableField = ({
  field,
  index,
  isEditing,
  newKeyName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onKeyNameChange,
  onValueChange,
  onDelete,
}: SortableFieldProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(120, Math.min(el.scrollHeight, 400))}px`;
    }
  }, []);

  useEffect(() => {
    autoResize();
  }, [field.value, autoResize]);

  const charCount = field.value.length;
  const suggestion = SUGGESTED_FIELDS.find(s => s.key.toLowerCase() === field.key.toLowerCase());

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-2 p-4 border rounded-lg bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={newKeyName}
                onChange={(e) => onKeyNameChange(e.target.value)}
                placeholder="Nome do campo"
                className="max-w-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
              />
              <Button size="icon" variant="ghost" onClick={onSaveEdit}>
                <Check className="h-4 w-4 text-primary" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Label htmlFor={`field-${index}`} className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {field.key}
              </Label>
              <Button
                size="icon"
                variant="ghost"
                onClick={onStartEdit}
                className="h-6 w-6 opacity-50 hover:opacity-100"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        ref={textareaRef}
        id={`field-${index}`}
        placeholder={suggestion?.placeholder || `Digite o conteúdo do campo ${field.key}...`}
        value={field.value}
        onChange={(e) => {
          onValueChange(e.target.value);
          autoResize();
        }}
        className="font-mono text-sm resize-none min-h-[120px] bg-muted/30 border-border focus-visible:ring-primary/50"
      />
      <div className="flex justify-end pt-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase">{charCount.toLocaleString()} caracteres</span>
      </div>
    </div>
  );
};

export function DynamicPromptEditor() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRecord | null>(null);
  const [fields, setFields] = useState<PromptField[]>([]);
  const [savedFields, setSavedFields] = useState<PromptField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [deleteFieldIndex, setDeleteFieldIndex] = useState<number | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { currentOrganization } = useOrganization();

  const isDirty = selectedPrompt && (
    JSON.stringify(fields) !== JSON.stringify(savedFields) ||
    selectedPrompt.name !== prompts.find(p => p.id === selectedPrompt.id)?.name ||
    selectedPrompt.description !== prompts.find(p => p.id === selectedPrompt.id)?.description
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build concatenated prompt preview
  const concatenatedPrompt = fields
    .filter(f => f.value.trim())
    .map(f => `## ${f.key}\n${f.value}`)
    .join('\n\n');

  const totalChars = fields.reduce((sum, f) => sum + f.value.length, 0);

  const loadPrompts = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPrompts((data || []) as any);
    } catch (err) {
      console.error('Error loading library:', err);
      toast({ variant: "destructive", title: "Erro", description: "Erro ao carregar biblioteca de prompts" });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const savePrompt = async () => {
    if (!currentOrganization?.id || !selectedPrompt) return;
    if (!selectedPrompt.name.trim()) {
      toast({ variant: "destructive", title: "Erro", description: "O nome do prompt é obrigatório" });
      return;
    }

    try {
      setSaving(true);
      // Preserve existing metadata (like is_head_prompt) when saving
      let existingMeta: any = {};
      try {
        const existingMetaStr = (prompts.find(pp => pp.id === selectedPrompt.id)?.fields || []).find((f: any) => f.key === '_metadata')?.value;
        if (existingMetaStr) existingMeta = JSON.parse(existingMetaStr);
      } catch {}
      const metaValue = JSON.stringify({ ...existingMeta, name: selectedPrompt.name, description: selectedPrompt.description });
      const promptData: any = {
        organization_id: currentOrganization.id,
        fields: [
          ...fields,
          { key: '_metadata', value: metaValue }
        ] as any,
        updated_at: new Date().toISOString()
      };

      let error;
      if (selectedPrompt.id && selectedPrompt.id !== '') {
        const { error: updateError } = await supabase
          .from('ai_prompts')
          .update(promptData)
          .eq('id', selectedPrompt.id);
        error = updateError;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Auth required');
        const { error: insertError } = await supabase
          .from('ai_prompts')
          .insert({ ...promptData, user_id: user.id });
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Sucesso", description: "Prompt salvo com sucesso!" });
      loadPrompts();
      setSavedFields([...fields]);
    } catch (err: any) {
      console.error('Error saving prompt:', err);
      toast({ variant: "destructive", title: "Erro ao salvar", description: err.message || "Erro ao salvar prompt" });
    } finally {
      setSaving(false);
    }
  };

  const deletePrompt = async (id: string) => {
    if (!currentOrganization?.id) return;
    try {
      const { error } = await supabase
        .from('ai_prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Excluído", description: "Prompt removido da biblioteca" });
      loadPrompts();
      if (selectedPrompt?.id === id) setSelectedPrompt(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
    } finally {
      setDeletePromptId(null);
    }
  };

  const duplicatePrompt = (prompt: PromptRecord) => {
    const cleanFields = (prompt.fields || []).filter((f: any) => f.key !== '_metadata');
    const duplicatedFields = cleanFields.map((f: any) => ({
      ...f,
      id: `${f.key}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }));
    const metadata = prompt.fields?.find((f: any) => f.key === '_metadata')?.value;
    const parsedMeta = metadata ? JSON.parse(metadata) : null;

    const newPrompt: PromptRecord = {
      id: '',
      name: `${prompt.name || parsedMeta?.name || 'Prompt'} (cópia)`,
      description: prompt.description || parsedMeta?.description || '',
      fields: duplicatedFields,
      created_at: '',
      updated_at: ''
    };
    setSelectedPrompt(newPrompt);
    setFields(duplicatedFields);
    setSavedFields([]);
    toast({ title: "Duplicado", description: "Prompt duplicado. Edite e salve para criar uma nova cópia." });
  };

  const setAsHeadPrompt = async (promptId: string) => {
    if (!currentOrganization?.id) return;
    try {
      // Remove head flag from all prompts first
      for (const p of prompts) {
        const meta = (p.fields || []).find((f: any) => f.key === '_metadata')?.value;
        if (!meta) continue;
        try {
          const parsed = JSON.parse(meta);
          if (parsed.is_head_prompt) {
            parsed.is_head_prompt = false;
            const updatedFields = (p.fields || []).map((f: any) =>
              f.key === '_metadata' ? { ...f, value: JSON.stringify(parsed) } : f
            );
            await supabase.from('ai_prompts').update({ fields: updatedFields as any }).eq('id', p.id);
          }
        } catch {}
      }
      // Set the selected prompt as head
      const target = prompts.find(p => p.id === promptId);
      if (target) {
        const metaField = (target.fields || []).find((f: any) => f.key === '_metadata');
        let parsed: any = {};
        if (metaField?.value) {
          try { parsed = JSON.parse(metaField.value); } catch { parsed = {}; }
        }
        parsed.is_head_prompt = true;
        // Preserve name/description in metadata
        if (!parsed.name) {
          parsed.name = target.name || 'Head Prompt';
        }
        const updatedFields = metaField
          ? (target.fields || []).map((f: any) => f.key === '_metadata' ? { ...f, value: JSON.stringify(parsed) } : f)
          : [...(target.fields || []), { key: '_metadata', value: JSON.stringify(parsed), id: `meta-${Date.now()}` }];
        const { error } = await supabase.from('ai_prompts').update({ fields: updatedFields as any }).eq('id', promptId);
        if (error) throw error;
      }
      toast({ title: "Head Prompt definido", description: "Este prompt será injetado no início de todos os agentes I.A." });
      await loadPrompts();
    } catch (err: any) {
      console.error('Error setting head prompt:', err);
      toast({ variant: "destructive", title: "Erro", description: err.message || "Erro ao definir Head Prompt" });
    }
  };

  const removeHeadPromptFlag = async (promptId: string) => {
    if (!currentOrganization?.id) return;
    try {
      const target = prompts.find(p => p.id === promptId);
      if (target) {
        const metaField = (target.fields || []).find((f: any) => f.key === '_metadata');
        if (metaField?.value) {
          let parsed: any = {};
          try { parsed = JSON.parse(metaField.value); } catch { parsed = {}; }
          parsed.is_head_prompt = false;
          const updatedFields = (target.fields || []).map((f: any) =>
            f.key === '_metadata' ? { ...f, value: JSON.stringify(parsed) } : f
          );
          const { error } = await supabase.from('ai_prompts').update({ fields: updatedFields as any }).eq('id', promptId);
          if (error) throw error;
        }
      }
      toast({ title: "Head Prompt removido" });
      await loadPrompts();
    } catch (err: any) {
      console.error('Error removing head prompt:', err);
      toast({ variant: "destructive", title: "Erro", description: err.message || "Erro ao remover Head Prompt" });
    }
  };
  const createNewPrompt = () => {
    const newPrompt: PromptRecord = {
      id: '',
      name: 'Novo Agente I.A',
      description: 'Defina o objetivo deste agente...',
      fields: [
        { key: 'Persona', value: '', id: `persona-${Date.now()}` },
        { key: 'Objetivo', value: '', id: `objetivo-${Date.now() + 1}` },
        { key: 'Instruções', value: '', id: `instrucoes-${Date.now() + 2}` },
      ],
      created_at: '',
      updated_at: ''
    };
    setSelectedPrompt(newPrompt);
    setFields(newPrompt.fields);
    setSavedFields(newPrompt.fields);
  };

  const handleAIGeneratedFields = (newFields: PromptField[]) => {
    if (!selectedPrompt) {
      const newPrompt: PromptRecord = {
        id: '',
        name: 'Agente Gerado por I.A',
        description: 'Prompt gerado automaticamente via Assistente de Briefing.',
        fields: newFields,
        created_at: '',
        updated_at: ''
      };
      setSelectedPrompt(newPrompt);
    }
    setFields(newFields);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addField = (suggestedKey?: string) => {
    const newKey = suggestedKey || `campo_${fields.length + 1}`;
    const newId = `${newKey}-${Date.now()}`;
    setFields([...fields, { key: newKey, value: "", id: newId }]);
  };

  const confirmDeleteField = () => {
    if (deleteFieldIndex !== null) {
      setFields(fields.filter((_, i) => i !== deleteFieldIndex));
      setDeleteFieldIndex(null);
    }
  };

  const updateFieldValue = (index: number, value: string) => {
    const newFields = [...fields];
    newFields[index].value = value;
    setFields(newFields);
  };

  const startEditKey = (index: number) => {
    setEditingKey(fields[index].key);
    setNewKeyName(fields[index].key);
  };

  const saveKeyEdit = (index: number) => {
    if (newKeyName.trim() && !fields.some((f, i) => f.key === newKeyName && i !== index)) {
      const newFields = [...fields];
      newFields[index].key = newKeyName.trim();
      setFields(newFields);
      setEditingKey(null);
      setNewKeyName("");
    } else {
      toast({ variant: "destructive", title: "Erro", description: "Nome do campo inválido ou já existe" });
    }
  };

  const cancelEditKey = () => {
    setEditingKey(null);
    setNewKeyName("");
  };

  const availableSuggestions = SUGGESTED_FIELDS.filter(
    s => !fields.some(f => f.key.toLowerCase() === s.key.toLowerCase())
  );

  if (loading && prompts.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  // --- RENDERING LIBRARY VIEW ---
  if (!selectedPrompt) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Biblioteca de Prompts
            </h2>
            <p className="text-sm text-muted-foreground">Gerencie seus modelos de instrução de I.A</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAIAssistant(true)}
              className="gap-2 border-primary/20 hover:bg-primary/10 text-primary"
            >
              <Wand2 className="h-4 w-4" />
              Gerar com I.A
            </Button>
            <Button onClick={createNewPrompt} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Prompt
            </Button>
          </div>
        </div>

        {/* Head Prompt Section */}
        {prompts.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/[0.03]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Head Prompt
              </CardTitle>
              <CardDescription className="text-xs">
                O Head Prompt é injetado no início de <strong>todos</strong> os Agentes I.A que o ativarem. Use para regras globais, identidade da marca e diretrizes universais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const headPrompt = prompts.find((p: any) => {
                  const meta = p.fields?.find((f: any) => f.key === '_metadata')?.value;
                  if (!meta) return false;
                  try { return JSON.parse(meta).is_head_prompt === true; } catch { return false; }
                });
                if (headPrompt) {
                  const meta = headPrompt.fields?.find((f: any) => f.key === '_metadata')?.value;
                  const parsedMeta = meta ? JSON.parse(meta) : {};
                  return (
                    <div className="flex items-center justify-between gap-3 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{headPrompt.name || parsedMeta?.name || "Head Prompt"}</p>
                          <p className="text-[10px] text-muted-foreground">{(headPrompt.fields || []).filter((f: any) => f.key !== '_metadata').length} campos</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => {
                          setSelectedPrompt(headPrompt);
                          const cleanFields = (headPrompt.fields || []).filter((f: any) => f.key !== '_metadata');
                          setFields(cleanFields);
                          setSavedFields(cleanFields);
                        }}>
                          <Edit2 className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={() => removeHeadPromptFlag(headPrompt.id)}>
                          <X className="h-3 w-3 mr-1" /> Remover Head
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <p className="text-xs text-muted-foreground italic text-center py-3">
                    Nenhum Head Prompt definido. Clique no ícone <Crown className="h-3 w-3 inline text-amber-500" /> em um prompt para defini-lo como Head.
                  </p>
                );
              })()}
            </CardContent>
          </Card>
        )}

        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Body Prompts — Instruções por Etapa</h3>

        {prompts.length === 0 ? (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg">Biblioteca vazia</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                Crie seu primeiro modelo de prompt para usar no Agente I.A
              </p>
            </div>
            <Button onClick={createNewPrompt} variant="outline" className="mt-2 border-primary/20 hover:bg-primary/10">
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Prompt
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prompts.map((p) => {
              const metadata = p.fields?.find((f: any) => f.key === '_metadata')?.value;
              let parsedMeta: any = null;
              try { parsedMeta = metadata ? JSON.parse(metadata) : null; } catch { parsedMeta = null; }
              const displayName = p.name || parsedMeta?.name || "Prompt sem nome";
              const displayDesc = p.description || parsedMeta?.description || "Sem descrição";
              const isHead = parsedMeta?.is_head_prompt === true;

              return (
                <Card
                  key={p.id}
                  className={`group hover:border-primary/40 transition-all duration-300 shadow-sm hover:shadow-primary/5 cursor-pointer relative ${isHead ? 'border-amber-500/40 ring-1 ring-amber-500/20' : ''}`}
                  onClick={() => {
                    const meta = p.fields?.find((f: any) => f.key === '_metadata')?.value;
                    let pm: any = null;
                    try { pm = meta ? JSON.parse(meta) : null; } catch {}
                    setSelectedPrompt({
                      ...p,
                      name: p.name || pm?.name || "Prompt sem nome",
                      description: p.description || pm?.description || "",
                    });
                    const cleanFields = (p.fields || []).filter((f: any) => f.key !== '_metadata');
                    setFields(cleanFields);
                    setSavedFields(cleanFields);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 pr-8">
                        {isHead && <Crown className="h-4 w-4 text-amber-500 shrink-0" />}
                        <CardTitle className="text-base truncate">{displayName}</CardTitle>
                      </div>
                      <div className="flex gap-1 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          title="Duplicar prompt"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicatePrompt(p);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletePromptId(p.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs min-h-[2.5rem]">
                      {displayDesc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        {isHead && (
                          <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 text-[10px] uppercase font-bold tracking-wider">
                            Head
                          </Badge>
                        )}
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] uppercase font-bold tracking-wider">
                          {(p.fields || []).filter((f: any) => f.key !== '_metadata').length} Campos
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        Atu. {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {/* Always-visible Head Prompt action */}
                    <div className="mt-3 pt-2 border-t border-border/50">
                      {isHead ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-[10px] border-amber-500/30 text-amber-600 hover:bg-amber-500/10 gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeHeadPromptFlag(p.id);
                          }}
                        >
                          <Crown className="h-3 w-3" />
                          Remover Head Prompt
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-[10px] border-amber-500/20 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAsHeadPrompt(p.id);
                          }}
                        >
                          <Crown className="h-3 w-3" />
                          Definir como Head Prompt
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AlertDialog open={deletePromptId !== null} onOpenChange={(open) => !open && setDeletePromptId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir prompt</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover este prompt da biblioteca? O nó do Agente I.A continuará com o texto já importado, mas o modelo central será excluído.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deletePrompt(deletePromptId!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir Permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <PromptGeneratorAssistant
          open={showAIAssistant}
          onOpenChange={setShowAIAssistant}
          onGenerate={handleAIGeneratedFields}
        />
      </div>
    );
  }

  // --- RENDERING EDITOR VIEW ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedPrompt(null)} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Edição de Prompt
            </h2>
            <p className="text-sm text-muted-foreground">Configurando instruções do agente</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-500 gap-1 hidden sm:flex">
              <AlertCircle className="h-3 w-3" />
              Não salvo
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => setShowAIAssistant(true)}
            className="gap-2 border-primary/20 hover:bg-primary/10 text-primary"
          >
            <Wand2 className="h-4 w-4" />
            Assistente
          </Button>
          <Button onClick={savePrompt} disabled={saving || (!isDirty && !!selectedPrompt.id)} className="gap-2 min-w-[120px]">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Prompt'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-primary/10 bg-primary/[0.02]">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Prompt</Label>
                <Input
                  value={selectedPrompt.name}
                  onChange={(e) => setSelectedPrompt({ ...selectedPrompt, name: e.target.value })}
                  placeholder="Ex: Atendente Roberta"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição / Objetivo</Label>
                <Textarea
                  value={selectedPrompt.description}
                  onChange={(e) => setSelectedPrompt({ ...selectedPrompt, description: e.target.value })}
                  placeholder="Descreva para que serve este prompt..."
                  className="bg-background min-h-[80px] text-xs resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Dica de Uso</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este prompt será agrupado no Editor de Fluxo. Ao selecionar este modelo no nó <strong>Agente I.A</strong>, o sistema concatenará todos os campos abaixo para formar a <code className="text-primary">System Message</code> do agente.
            </p>
          </div>

          <div className="rounded-xl border border-primary/10 bg-primary/[0.02] p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Boas Práticas</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                Seja específico na <strong>Persona</strong>: nome, tom, limitações
              </li>
              <li className="flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                Defina o que o agente <strong>NÃO</strong> deve fazer nas <strong>Restrições</strong>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                Use <strong>Exemplos de Conversa</strong> para calibrar o estilo
              </li>
              <li className="flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                Inclua regras de mensagem: limite de caracteres, emojis, frequência
              </li>
              <li className="flex items-start gap-1.5">
                <span className="h-1 w-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                Mais campos preenchidos = agente mais preciso e consistente
              </li>
            </ul>
          </div>

          {/* Prompt Stats */}
          <div className="rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estatísticas</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold text-foreground">{fields.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Campos</div>
              </div>
              <div className="text-center p-2 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold text-foreground">{totalChars.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground uppercase">Caracteres</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    index={index}
                    isEditing={editingKey === field.key}
                    newKeyName={newKeyName}
                    onStartEdit={() => startEditKey(index)}
                    onSaveEdit={() => saveKeyEdit(index)}
                    onCancelEdit={cancelEditKey}
                    onKeyNameChange={setNewKeyName}
                    onValueChange={(value) => updateFieldValue(index, value)}
                    onDelete={() => setDeleteFieldIndex(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="space-y-3">
            <Button onClick={() => addField()} variant="outline" className="w-full border-dashed border-2 h-12 hover:border-primary/50 hover:bg-primary/5 transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Campo Personalizado
            </Button>
            {availableSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="text-[10px] text-muted-foreground uppercase font-bold self-center">Sugestões:</span>
                {availableSuggestions.slice(0, 6).map(s => (
                  <Button
                    key={s.key}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] uppercase font-bold tracking-tight bg-primary/5 hover:bg-primary/10"
                    onClick={() => addField(s.key)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {s.key}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Concatenated Prompt Preview */}
          <Collapsible open={showPreview} onOpenChange={setShowPreview}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full gap-2 border-primary/20 hover:bg-primary/5">
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? 'Ocultar' : 'Visualizar'} System Message Final
                <ChevronDown className={`h-4 w-4 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5" />
                    Preview — System Message concatenada
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    Este é o texto final que será enviado como instrução ao modelo de I.A quando este prompt for selecionado.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {concatenatedPrompt ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border border-border max-h-[400px] overflow-y-auto leading-relaxed">
                      {concatenatedPrompt}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground italic text-center py-6">
                      Preencha os campos acima para visualizar o prompt final.
                    </p>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      <AlertDialog open={deleteFieldIndex !== null} onOpenChange={(open) => !open && setDeleteFieldIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o campo <strong>"{deleteFieldIndex !== null ? fields[deleteFieldIndex]?.key : ''}"</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteField} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PromptGeneratorAssistant
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        onGenerate={handleAIGeneratedFields}
      />
    </div>
  );
}
