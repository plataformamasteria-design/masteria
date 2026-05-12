import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Clock } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface AnalyticsConfig {
  id: string;
  conversion_start_tag_id?: string;
  conversion_end_tag_id?: string;
  sales_cycle_start_tag_id?: string;
  sales_cycle_end_tag_id?: string;
}

interface AnalyticsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AnalyticsConfigDialog({ open, onOpenChange }: AnalyticsConfigDialogProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [config, setConfig] = useState<AnalyticsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [conversionStart, setConversionStart] = useState<string>("");
  const [conversionEnd, setConversionEnd] = useState<string>("");
  const [salesCycleStart, setSalesCycleStart] = useState<string>("");
  const [salesCycleEnd, setSalesCycleEnd] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
      if (!profile?.organization_id) return;

      const [tagsResult, configResult] = await Promise.all([
        supabase.from('tags').select('*').eq('organization_id', profile.organization_id).order('order_position'),
        supabase.from('analytics_config').select('*').eq('organization_id', profile.organization_id).single()
      ]);

      if (tagsResult.data) setTags(tagsResult.data);
      if (configResult.data) {
        setConfig(configResult.data);
        setConversionStart(configResult.data.conversion_start_tag_id || "");
        setConversionEnd(configResult.data.conversion_end_tag_id || "");
        setSalesCycleStart(configResult.data.sales_cycle_start_tag_id || "");
        setSalesCycleEnd(configResult.data.sales_cycle_end_tag_id || "");
      }
    } catch (error) {
      console.error('Error fetching analytics config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('analytics_config')
        .update({
          conversion_start_tag_id: conversionStart || null,
          conversion_end_tag_id: conversionEnd || null,
          sales_cycle_start_tag_id: salesCycleStart || null,
          sales_cycle_end_tag_id: salesCycleEnd || null
        })
        .eq('id', config.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de análise atualizadas"
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving analytics config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurações de Análise</DialogTitle>
          <DialogDescription>
            Configure as etiquetas para calcular métricas de conversão e ciclo de vendas
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Taxa de Conversão */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Taxa de Conversão
              </h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="conversion-start">Etiqueta Inicial</Label>
                  <Select value={conversionStart} onValueChange={setConversionStart}>
                    <SelectTrigger id="conversion-start">
                      <SelectValue placeholder="Selecione a etiqueta inicial" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="conversion-end">Etiqueta Final (Conversão)</Label>
                  <Select value={conversionEnd} onValueChange={setConversionEnd}>
                    <SelectTrigger id="conversion-end">
                      <SelectValue placeholder="Selecione a etiqueta de conversão" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Ciclo de Vendas */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Ciclo de Vendas
              </h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="sales-cycle-start">Etiqueta Inicial</Label>
                  <Select value={salesCycleStart} onValueChange={setSalesCycleStart}>
                    <SelectTrigger id="sales-cycle-start">
                      <SelectValue placeholder="Selecione a etiqueta inicial" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sales-cycle-end">Etiqueta Final</Label>
                  <Select value={salesCycleEnd} onValueChange={setSalesCycleEnd}>
                    <SelectTrigger id="sales-cycle-end">
                      <SelectValue placeholder="Selecione a etiqueta final" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
