'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Slider } from '@/components/ui/slider';
import { VoiceAgent, CreateAgentData, UpdateAgentData } from '@/hooks/useVoiceAgents';
import { Loader2, Volume2, VolumeX, Pause } from 'lucide-react';

interface VoiceAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: VoiceAgent | null;
  onSave: (data: CreateAgentData | UpdateAgentData) => Promise<VoiceAgent | null>;
}

interface VoiceOption {
  value: string;
  label: string;
  previewUrl?: string;
}

const modelOptions = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.0 Flash' },
];

const defaultVoices: VoiceOption[] = [
  { value: 'cartesia-Hailey-Portugese-Brazilian', label: 'Hailey (Feminino PT-BR Nativo)' },
  { value: '11labs-Adrian', label: 'Adrian (Masculino)' },
  { value: '11labs-Rachel', label: 'Rachel (Feminino)' },
  { value: 'openai-Nova', label: 'Nova (OpenAI)' },
];

export function VoiceAgentDialog({ open, onOpenChange, agent, onSave }: VoiceAgentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>(defaultVoices);
  const [_loadingVoices, setLoadingVoices] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'inbound' as 'inbound' | 'outbound' | 'transfer',
    systemPrompt: '',
    firstMessage: '',
    voiceId: 'cartesia-Hailey-Portugese-Brazilian',
    llmModel: 'gpt-4',
    temperature: 0.7,
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    if (open && voiceOptions.length <= defaultVoices.length) {
      setLoadingVoices(true);
      fetch('/api/v1/voice/retell/voices')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.length > 0) {
            const voices = data.data.map((v: { voice_id: string; voice_name: string; provider: string; gender?: string; preview_audio_url?: string }) => ({
              value: v.voice_id,
              label: `${v.voice_name} (${v.provider}${v.gender ? ' - ' + v.gender : ''})`,
              previewUrl: v.preview_audio_url,
            }));
            setVoiceOptions(voices);
          }
        })
        .catch(err => console.error('Error fetching voices:', err))
        .finally(() => setLoadingVoices(false));
    }
  }, [open, voiceOptions.length]);

  useEffect(() => {
    return () => {
      if (audioRef) {
        audioRef.pause();
        audioRef.src = '';
      }
    };
  }, [audioRef]);

  const playVoicePreview = (voiceId: string) => {
    const voice = voiceOptions.find(v => v.value === voiceId);
    if (!voice?.previewUrl) return;

    if (playingVoiceId === voiceId && audioRef) {
      audioRef.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioRef) {
      audioRef.pause();
    }

    const audio = new Audio(voice.previewUrl);
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
    audio.play();
    setAudioRef(audio);
    setPlayingVoiceId(voiceId);
  };

  const selectedVoice = voiceOptions.find(v => v.value === formData.voiceId);

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        type: agent.type,
        systemPrompt: agent.systemPrompt,
        firstMessage: agent.firstMessage || '',
        voiceId: agent.voiceId || 'cartesia-Hailey-Portugese-Brazilian',
        llmModel: agent.llmModel,
        temperature: agent.temperature,
        status: agent.status === 'archived' ? 'inactive' : agent.status,
      });
    } else {
      setFormData({
        name: '',
        type: 'inbound',
        systemPrompt: '',
        firstMessage: '',
        voiceId: 'cartesia-Hailey-Portugese-Brazilian',
        llmModel: 'gpt-4',
        temperature: 0.7,
        status: 'active',
      });
    }
  }, [agent, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data = agent
      ? {
        name: formData.name,
        type: formData.type,
        systemPrompt: formData.systemPrompt,
        firstMessage: formData.firstMessage || undefined,
        voiceId: formData.voiceId,
        llmModel: formData.llmModel,
        temperature: formData.temperature,
        status: formData.status,
      }
      : {
        name: formData.name,
        type: formData.type,
        systemPrompt: formData.systemPrompt,
        firstMessage: formData.firstMessage || undefined,
        voiceId: formData.voiceId,
        llmModel: formData.llmModel,
        temperature: formData.temperature,
      };

    try {
      await fetch('/api/v1/voice/retell/sync-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: formData.voiceId }),
      });
    } catch (err) {
      console.error('Error syncing voice to Retell:', err);
    }

    const result = await onSave(data);
    setSaving(false);

    if (result) {
      onOpenChange(false);
    }
  };

  const isEditing = !!agent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Agente' : 'Novo Agente de Voz'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Atualize as configurações do agente de voz.'
                : 'Configure um novo agente de voz com IA.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Agente *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Suporte Técnico"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'inbound' | 'outbound' | 'transfer') =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Receptivo (Inbound)</SelectItem>
                    <SelectItem value="outbound">Ativo (Outbound)</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEditing && (
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'active' | 'inactive') =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="systemPrompt">Prompt do Sistema *</Label>
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Descreva o comportamento e personalidade do agente..."
                rows={4}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="firstMessage">Mensagem Inicial</Label>
              <Input
                id="firstMessage"
                value={formData.firstMessage}
                onChange={(e) => setFormData({ ...formData, firstMessage: e.target.value })}
                placeholder="Ex: Olá! Como posso ajudá-lo hoje?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="voiceId">Voz</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.voiceId}
                    onValueChange={(value) => setFormData({ ...formData, voiceId: value })}
                  >
                    <SelectTrigger id="voiceId" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceOptions.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => playVoicePreview(formData.voiceId)}
                    disabled={!selectedVoice?.previewUrl}
                    title={selectedVoice?.previewUrl ? 'Ouvir voz' : 'Preview indisponível'}
                  >
                    {playingVoiceId === formData.voiceId ? (
                      <Pause className="h-4 w-4" />
                    ) : selectedVoice?.previewUrl ? (
                      <Volume2 className="h-4 w-4" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="llmModel">Modelo IA</Label>
                <Select
                  value={formData.llmModel}
                  onValueChange={(value) => setFormData({ ...formData, llmModel: value })}
                >
                  <SelectTrigger id="llmModel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Temperatura: {formData.temperature.toFixed(1)}</Label>
                <span className="text-xs text-muted-foreground">
                  {formData.temperature < 0.3
                    ? 'Mais preciso'
                    : formData.temperature > 0.7
                      ? 'Mais criativo'
                      : 'Balanceado'}
                </span>
              </div>
              <Slider
                value={[formData.temperature]}
                onValueChange={(values) => setFormData({ ...formData, temperature: values[0] ?? 0.7 })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Criar Agente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
