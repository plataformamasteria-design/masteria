import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileJson, CheckCircle2, AlertTriangle } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ExportedAutomation, importPlatformAutomation } from "@/lib/automation-export-import";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportAutomationDialog({ open, onOpenChange, onImported }: Props) {
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ExportedAutomation | null>(null);
  const [automationName, setAutomationName] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isKommo, setIsKommo] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        if (data._format === "vitta-automation-v1") {
          setPreview(data);
          setAutomationName(data.name || "Automação Importada");
          setIsKommo(false);
        } else if (data.type_functionality !== undefined && data.model?.text) {
          // Kommo format detected
          setIsKommo(true);
          setPreview(null);
          toast({
            title: "Formato Kommo detectado",
            description: "Use o botão 'Importar Kommo' para importar automações do Kommo.",
            variant: "destructive",
          });
          return;
        } else {
          toast({ variant: "destructive", title: "Formato não reconhecido", description: "O arquivo não é uma automação exportada válida." });
          return;
        }
      } catch (err: any) {
        toast({ variant: "destructive", title: "Erro ao ler arquivo", description: err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || !currentOrganization?.id || !automationName.trim()) return;
    setImporting(true);

    try {
      const { data: userData } = await supabase.auth.getSession();
      const userId = userData.session?.user?.id;

      const automationId = await importPlatformAutomation(
        preview,
        currentOrganization.id,
        automationName.trim(),
        userId
      );

      toast({ title: "Automação importada com sucesso!" });
      onImported();
      onOpenChange(false);
      navigate(`/automations/${automationId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao importar", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const resetState = () => {
    setPreview(null);
    setFileName("");
    setAutomationName("");
    setIsKommo(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Automação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!preview && (
            <div className="space-y-2">
              <Label>Arquivo JSON da automação</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {fileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileJson className="h-5 w-5 text-primary" />
                    <span className="font-medium">{fileName}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar o arquivo JSON
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Aceita arquivos exportados da plataforma
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da automação</Label>
                <Input
                  value={automationName}
                  onChange={(e) => setAutomationName(e.target.value)}
                  placeholder="Nome da automação"
                />
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Prévia da importação
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Nós: <strong className="text-foreground">{preview.nodes.length}</strong></span>
                  <span>Conexões: <strong className="text-foreground">{preview.edges.length}</strong></span>
                  <span>Gatilho: <strong className="text-foreground">{preview.trigger_type}</strong></span>
                  {preview.exported_at && (
                    <span>Exportada: <strong className="text-foreground">{new Date(preview.exported_at).toLocaleDateString("pt-BR")}</strong></span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {preview && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={resetState}>
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleImport}
                disabled={importing || !automationName.trim()}
              >
                {importing ? "Importando..." : "Importar"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
