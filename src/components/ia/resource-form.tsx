'use client';

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { AgentResource } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { Save } from 'lucide-react';

interface ResourceFormProps {
    initialData?: AgentResource | null;
    onSave: (resource: AgentResource) => void;
    onClose?: () => void;
}

export function ResourceForm({ initialData, onSave, onClose }: ResourceFormProps) {
    const [formData, setFormData] = useState<Partial<AgentResource>>({
        id: initialData?.id || uuidv4(),
        name: initialData?.name || '',
        type: initialData?.type || 'LINK',
        content: initialData?.content || '',
        description: initialData?.description || '',
        isActive: initialData?.isActive ?? true,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // ✅ Sync form state when prop changes (Edit -> Add or switching items)
    useEffect(() => {
        setFormData({
            id: initialData?.id || uuidv4(),
            name: initialData?.name || '',
            type: initialData?.type || 'LINK',
            content: initialData?.content || '',
            description: initialData?.description || '',
            isActive: initialData?.isActive ?? true,
        });
        // Reset states when switching resources
        setShowSuccess(false);
        setIsSaving(false);
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.content && formData.type) {
            setIsSaving(true);

            // Call onSave
            onSave(formData as AgentResource);

            // Show success message
            setShowSuccess(true);
            setIsSaving(false);

            // Auto-close after 1 second
            setTimeout(() => {
                setShowSuccess(false);
                if (onClose) {
                    onClose();
                }
            }, 1000);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="resource-name">Nome do Recurso</Label>
                <Input
                    id="resource-name"
                    placeholder="Ex: Checkout Anual, Chave Pix"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="resource-type">Tipo</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(val: any) => setFormData({ ...formData, type: val })}
                    >
                        <SelectTrigger id="resource-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="LINK">Link / URL</SelectItem>
                            <SelectItem value="PIX">Chave Pix</SelectItem>
                            <SelectItem value="TEXT">Texto Curto</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2 flex items-center justify-between pt-6">
                    <Label htmlFor="resource-active">Ativo?</Label>
                    <Switch
                        id="resource-active"
                        checked={formData.isActive}
                        onCheckedChange={checked => setFormData({ ...formData, isActive: checked })}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="resource-content">Conteúdo (URL, Chave ou Texto)</Label>
                {formData.type === 'PIX' ? (
                    <Textarea
                        id="resource-content"
                        placeholder="Cole aqui o código PIX completo (copia e cola)"
                        value={formData.content}
                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                        required
                        className="font-mono text-xs min-h-[80px]"
                    />
                ) : (
                    <Input
                        id="resource-content"
                        placeholder={
                            formData.type === 'LINK' ? 'https://...' :
                                'Texto a ser enviado'
                        }
                        value={formData.content}
                        onChange={e => setFormData({ ...formData, content: e.target.value })}
                        required
                    />
                )}
            </div>

            <div className="space-y-2">
                <Label htmlFor="resource-desc">Descrição (Contexto para a IA)</Label>
                <Textarea
                    id="resource-desc"
                    placeholder="Ex: Enviar quando o cliente insistir em pagar à vista."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="h-20"
                />
                <p className="text-xs text-muted-foreground">Explique quando a IA deve usar este recurso.</p>
            </div>

            <div className="flex justify-end pt-2 gap-2 items-center">
                {showSuccess && (
                    <span className="text-emerald-600 font-semibold text-sm flex items-center gap-1 animate-pulse">
                        ✓ SALVO!
                    </span>
                )}
                <Button type="submit" disabled={isSaving || showSuccess}>
                    <Save className="h-4 w-4 mr-2" />
                    {showSuccess ? 'Salvo!' : isSaving ? 'Salvando...' : 'Salvar Recurso'}
                </Button>
            </div>
        </form>
    );
}
