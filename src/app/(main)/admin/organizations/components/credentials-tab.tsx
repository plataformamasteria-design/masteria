'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, Save, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSystemSettings, updateSystemSettings } from '@/app/actions/superadmin-actions';

export function CredentialsTab() {
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
    loadSettings();
  }, []);

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
      
      if (!openaiKey.includes('...')) dataToSave.openaiApiKey = openaiKey;
      if (!geminiKey.includes('...')) dataToSave.geminiApiKey = geminiKey;
      if (!elevenlabsKey.includes('...')) dataToSave.elevenlabsApiKey = elevenlabsKey;

      const result = await updateSystemSettings(dataToSave);
      
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Credenciais globais atualizadas com sucesso',
        });
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
      <div className="relative max-w-md">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="pr-10 bg-background border-border/50 focus:border-primary/50 font-mono"
          onFocus={() => {
            if (value.includes('...')) {
              setValue('');
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground"
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        Usado globalmente se uma empresa não tiver credencial própria configurada.
      </p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
        <div className="flex flex-col gap-1 mb-6">
            <h2 className="text-xl font-bold tracking-tight">Credenciais Globais de IA</h2>
            <p className="text-sm text-muted-foreground">Gerencie as chaves de API globais do sistema. Elas serão usadas como fallback caso a empresa não tenha configurado suas próprias chaves.</p>
        </div>

        <Card className="shadow-sm border-border/40">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-indigo-500" />
                    Chaves de Provedores
                </CardTitle>
                <CardDescription>
                    As chaves são mascaradas ('...') para segurança. Para alterar, digite a nova chave no campo.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p>Carregando credenciais...</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {renderPasswordField('openai-key', 'OpenAI API Key', openaiKey, setOpenaiKey, showOpenai, setShowOpenai, 'sk-proj-...')}
                        {renderPasswordField('gemini-key', 'Google Gemini API Key', geminiKey, setGeminiKey, showGemini, setShowGemini, 'AIzaSy...')}
                        {renderPasswordField('elevenlabs-key', 'ElevenLabs API Key', elevenlabsKey, setElevenlabsKey, showElevenlabs, setShowElevenlabs, 'sk_...')}
                        
                        <div className="pt-6 border-t border-border/40">
                            <Button 
                                onClick={handleSave} 
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]"
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {saving ? 'Salvando...' : 'Salvar Chaves Globais'}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
