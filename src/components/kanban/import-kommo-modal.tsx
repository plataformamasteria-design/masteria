'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export function ImportKommoModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/kanban/import-kommo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao importar arquivo');
      }

      const result = await response.json();
      
      toast({
        title: 'Importação concluída!',
        description: `Foram importados ${result.leadsCount || 0} leads com sucesso.`,
      });
      
      setOpen(false);
      setFile(null);
      
      // Force refresh
      router.refresh();
      
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Falha na importação',
        description: error.message || 'Ocorreu um erro ao processar a planilha.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-emerald-600 dark:text-emerald-400 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:border-emerald-900">
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline ml-1.5">Importar Kommo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Importar do Kommo</DialogTitle>
          <DialogDescription>
            Faça upload do arquivo Excel (.xlsx) ou CSV exportado do Kommo CRM. O sistema criará os funis, etapas, contatos e leads automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="file">Planilha de Leads</Label>
            <Input 
              id="file" 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={!file || loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Iniciar Importação'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
