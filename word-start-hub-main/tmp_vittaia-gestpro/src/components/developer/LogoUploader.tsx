import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSystemLogo } from '@/hooks/useSystemLogo';
import { useOrganization } from '@/contexts/OrganizationContext';

export const LogoUploader = () => {
  const { toast } = useToast();
  const { logoUrl } = useSystemLogo();
  const { currentOrganization } = useOrganization();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      
      if (!file) return;

      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Erro',
          description: 'Por favor, selecione um arquivo de imagem',
          variant: 'destructive',
        });
        return;
      }

      // Validar tamanho (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'Erro',
          description: 'A imagem deve ter no máximo 2MB',
          variant: 'destructive',
        });
        return;
      }

      // Buscar configuração atual do banco ANTES de fazer upload
      const { data: currentConfig } = await supabase
        .from('system_config')
        .select('id, logo_url')
        .eq('organization_id', currentOrganization?.id)
        .single();

      // Upload para storage
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Atualizar configuração do sistema
      const { error: updateError } = await supabase
        .from('system_config')
        .update({ logo_url: publicUrl })
        .eq('id', currentConfig?.id);

      if (updateError) throw updateError;

      // Deletar logo antigo DEPOIS de atualizar o banco
      if (currentConfig?.logo_url) {
        const oldFileName = currentConfig.logo_url.split('/').pop();
        if (oldFileName && oldFileName !== fileName) {
          await supabase.storage.from('logos').remove([oldFileName]);
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Logo atualizado com sucesso',
      });

      // Limpar input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao fazer upload do logo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);

      if (!logoUrl) return;

      // Buscar config atual
      const { data: currentConfig } = await supabase
        .from('system_config')
        .select('id, logo_url')
        .eq('organization_id', currentOrganization?.id)
        .single();

      if (!currentConfig) return;

      // Atualizar banco PRIMEIRO (para null)
      const { error: updateError } = await supabase
        .from('system_config')
        .update({ logo_url: null })
        .eq('id', currentConfig.id);

      if (updateError) throw updateError;

      // Deletar arquivo do storage DEPOIS
      if (currentConfig.logo_url) {
        const fileName = currentConfig.logo_url.split('/').pop();
        if (fileName) {
          const { error: deleteError } = await supabase.storage
            .from('logos')
            .remove([fileName]);
          
          if (deleteError) {
            console.error('Error deleting file from storage:', deleteError);
            // Não lançar erro aqui - o banco já foi atualizado
          }
        }
      }

      toast({
        title: 'Sucesso',
        description: 'Logo removido com sucesso',
      });
    } catch (error) {
      console.error('Error deleting logo:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao remover logo',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="gradient-text">Logo do Sistema</CardTitle>
        <CardDescription>
          Faça upload do logo que será exibido nas páginas de autenticação e no menu lateral
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl && (
          <div className="flex items-center justify-between p-4 border border-border/40 rounded-lg bg-background/50">
            <div className="flex items-center gap-3">
              <img 
                src={logoUrl} 
                alt="Logo atual" 
                className="h-12 w-12 object-contain rounded"
              />
              <div>
                <p className="text-sm font-medium">Logo atual</p>
                <p className="text-xs text-muted-foreground">Clique em "Fazer Upload" para substituir</p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? 'Removendo...' : 'Remover'}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <Input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
            id="logo-upload"
          />
          <label htmlFor="logo-upload" className="flex-1">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => document.getElementById('logo-upload')?.click()}
            >
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Fazendo Upload...
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Fazer Upload de Logo
                </>
              )}
            </Button>
          </label>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Formatos aceitos: PNG, JPG, SVG</p>
          <p>• Tamanho máximo: 2MB</p>
          <p>• Recomendado: Logo transparente em PNG</p>
        </div>
      </CardContent>
    </Card>
  );
};
