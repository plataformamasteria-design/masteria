'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Save, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSystemSettings, updateSystemSettings } from '@/app/actions/superadmin-actions';

interface GlobalCredentialsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalCredentialsDrawer({ open, onOpenChange }: GlobalCredentialsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');

  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showElevenlabs, setShowElevenlabs] = useState(false);

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await getSystemSettings();
      setOpenaiKey(settings.openaiApiKey || '');
      setGeminiKey(settings.geminiApiKey || '');
      setElevenlabsKey(settings.elevenlabsApiKey || '');
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações globais',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave: any = {};
      
      // Só enviamos os campos que o usuário alterou ativamente.
      // Se tiver '...' significa que ele não alterou e não precisamos atualizar (evitando sobrescrever com máscara)
      if (!openaiKey.includes('...')) dataToSave.openaiApiKey = openaiKey;
      if (!geminiKey.includes('...')) dataToSave.geminiApiKey = geminiKey;
      if (!elevenlabsKey.includes('...')) dataToSave.elevenlabsApiKey = elevenlabsKey;

      const result = await updateSystemSettings(dataToSave);
      
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Credenciais globais atualizadas com sucesso',
        });
        onOpenChange(false);
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Falha ao salvar as credenciais',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderPasswordField = (
    id: string,
    label: string,
    value: string,
    setValue: (val: string) => void,
    show: boolean,
    setShow: (val: boolean) => void,
    placeholder: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pr-10 bg-zinc-900 border-zinc-800 focus:border-zinc-700"
          onFocus={() => {
            // Se o campo ainda tem a máscara '...', limpamos para o usuário digitar
            if (value.includes('...')) {
              setValue('');
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-zinc-400 hover:text-zinc-300"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Usado globalmente se uma empresa não tiver credencial própria configurada.
      </p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md border-l border-zinc-800 bg-zinc-950 p-0 flex flex-col gap-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SheetHeader className="px-6 py-6 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-10">
            <SheetTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5 text-indigo-400" />
              Credenciais Globais de IA
            </SheetTitle>
            <SheetDescription className="text-zinc-400">
              Gerencie as chaves de API globais do sistema. Elas serão usadas como fallback caso a empresa não tenha configurado suas próprias chaves.
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Carregando credenciais...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {renderPasswordField(
                  'openai-key',
                  'OpenAI API Key',
                  openaiKey,
                  setOpenaiKey,
                  showOpenai,
                  setShowOpenai,
                  'sk-proj-...'
                )}
                
                {renderPasswordField(
                  'gemini-key',
                  'Google Gemini API Key',
                  geminiKey,
                  setGeminiKey,
                  showGemini,
                  setShowGemini,
                  'AIzaSy...'
                )}
                
                {renderPasswordField(
                  'elevenlabs-key',
                  'ElevenLabs API Key',
                  elevenlabsKey,
                  setElevenlabsKey,
                  showElevenlabs,
                  setShowElevenlabs,
                  'sk_...'
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950 sticky bottom-0 z-10 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-zinc-800 hover:bg-zinc-800/50"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Credenciais
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
