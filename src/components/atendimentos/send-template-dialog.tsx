// src/components/atendimentos/send-template-dialog.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { Template, Contact } from '@/lib/types';
import { Loader2, Variable } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SendTemplateDialogProps {
  children: React.ReactNode;
  templates: Template[];
  connectionId: string;
  contact: Contact;
}

/** Extrai variáveis {{N}} ou {{nome}} do body de um template */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  // Deduplica mantendo ordem
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
}

/** Substitui {{N}} pelo valor digitado para preview */
function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] || `{{${key.trim()}}}`);
}

export function SendTemplateDialog({ children, templates, connectionId, contact }: SendTemplateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();

  const templateList = useMemo(() => {
    return Array.isArray(templates) ? templates : [];
  }, [templates]);

  const selectedTemplate = useMemo(() => {
    return templateList.find(t => t.id === selectedTemplateId);
  }, [selectedTemplateId, templateList]);

  const templateBody = useMemo(() => {
    if (!selectedTemplate?.components) return '';
    const componentsArray = Array.isArray(selectedTemplate.components)
      ? selectedTemplate.components
      : [];
    const bodyComponent = componentsArray.find((c: any) => c.type === 'BODY');
    return bodyComponent?.text || '';
  }, [selectedTemplate]);

  // Extrair variáveis do body do template selecionado
  const templateVariables = useMemo(() => extractVariables(templateBody), [templateBody]);

  // Preview em tempo real com variáveis preenchidas
  const previewText = useMemo(
    () => applyVariables(templateBody, variableValues),
    [templateBody, variableValues]
  );

  // Quando o template muda, resetar variáveis e pré-preencher com dados do contato
  const handleTemplateChange = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setVariableValues({});
  }, []);

  const handleVariableChange = (varKey: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [varKey]: value }));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate || !contact || !connectionId) {
      notify.error('Erro', 'Dados incompletos para iniciar a conversa.');
      return;
    }

    // Verificar se todas as variáveis foram preenchidas
    const missing = templateVariables.filter(v => !variableValues[v]?.trim());
    if (missing.length > 0) {
      notify.error('Variáveis pendentes', `Preencha: ${missing.join(', ')}`);
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/v1/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          connectionId: connectionId,
          templateId: selectedTemplate.id,
          variableMappings: variableValues,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Falha ao iniciar a conversa.');
      }

      notify.success('Conversa Iniciada!', 'A mensagem foi enviada com sucesso.');
      setIsOpen(false);
      setSelectedTemplateId('');
      setVariableValues({});
      router.push(`/atendimentos?conversationId=${result.conversationId}`);

    } catch (error) {
      notify.error('Erro ao Enviar', (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [contact, connectionId, selectedTemplate, templateVariables, variableValues, notify, router]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) { setSelectedTemplateId(''); setVariableValues({}); }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Iniciar Conversa com Modelo</DialogTitle>
            <DialogDescription>
              Selecione um modelo aprovado pelo Meta para iniciar uma nova conversa com este contato.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 py-3 px-1">
              {/* Seleção de template */}
              <div className="space-y-1.5">
                <Label htmlFor="template-select">Modelo de Mensagem</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger id="template-select">
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templateList.filter(t => t.status === 'APPROVED' || t.status === 'APROVADO').map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inputs dinâmicos para variáveis */}
              {templateVariables.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Variable className="h-3.5 w-3.5" />
                    Preencha as variáveis do template
                  </div>
                  {templateVariables.map(varKey => (
                    <div key={varKey} className="space-y-1.5">
                      <Label htmlFor={`var-${varKey}`} className="text-sm">
                        {`{{${varKey}}}`}
                      </Label>
                      <Input
                        id={`var-${varKey}`}
                        placeholder={`Valor para {{${varKey}}}...`}
                        value={variableValues[varKey] || ''}
                        onChange={e => handleVariableChange(varKey, e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview do template */}
              {selectedTemplate && templateBody && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
                  <div className="p-4 border rounded-lg bg-muted/30 text-sm leading-relaxed">
                    <p className="whitespace-pre-wrap">{previewText}</p>
                  </div>
                  {templateVariables.length > 0 && templateVariables.some(v => !variableValues[v]) && (
                    <p className="text-[11px] text-amber-500">
                      ⚠️ Preencha todas as variáveis antes de enviar
                    </p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4">
            <Button type="button" variant="secondary" disabled={isProcessing} onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!selectedTemplateId || isProcessing || (templateVariables.length > 0 && templateVariables.some(v => !variableValues[v]?.trim()))}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
