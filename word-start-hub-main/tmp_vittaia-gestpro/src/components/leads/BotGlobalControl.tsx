import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Toggle from "@/components/Toggle";
import { useOrganization } from "@/contexts/OrganizationContext";

interface BotGlobalControlProps {
  onRefresh: () => void;
}

const BotGlobalControl = ({ onRefresh }: BotGlobalControlProps) => {
  const [globalBotEnabled, setGlobalBotEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    fetchBotSettings();
  }, []);

  const fetchBotSettings = async () => {
    if (!currentOrganization?.id) return;

    const { data, error } = await (supabase as any)
      .from('bot_settings')
      .select('global_bot_enabled')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching bot settings:', error);
      return;
    }

    if (data) {
      setGlobalBotEnabled(data.global_bot_enabled);
    } else {
      // Criar configuração inicial se não existir
      await (supabase as any).from('bot_settings').insert({
        global_bot_enabled: true,
        organization_id: currentOrganization.id
      });
      setGlobalBotEnabled(true);
    }
  };

  const handleToggleGlobal = async () => {
    if (!currentOrganization?.id) return;
    
    setLoading(true);
    const newValue = !globalBotEnabled;

    // Buscar o registro de configuração desta organização
    const { data: currentSettings } = await (supabase as any)
      .from('bot_settings')
      .select('id')
      .eq('organization_id', currentOrganization.id)
      .maybeSingle();

    let error;
    if (currentSettings?.id) {
      // Atualizar o registro existente
      const result = await (supabase as any)
        .from('bot_settings')
        .update({ global_bot_enabled: newValue })
        .eq('id', currentSettings.id);
      error = result.error;
    } else {
      // Criar novo registro se não existir
      const result = await (supabase as any)
        .from('bot_settings')
        .insert({ 
          global_bot_enabled: newValue,
          organization_id: currentOrganization.id
        });
      error = result.error;
    }

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status global do robô",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    setGlobalBotEnabled(newValue);
    toast({
      title: newValue ? "Robô ativado globalmente" : "Robô desativado globalmente",
      description: newValue 
        ? "O robô foi ativado para todos os leads" 
        : "O robô foi desativado para todos os leads"
    });
    setLoading(false);
    onRefresh();
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border rounded-lg">
      <Bot className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Robô Global:</span>
      <Toggle
        checked={globalBotEnabled}
        onChange={handleToggleGlobal}
        disabled={loading}
      />
    </div>
  );
};

export default BotGlobalControl;
