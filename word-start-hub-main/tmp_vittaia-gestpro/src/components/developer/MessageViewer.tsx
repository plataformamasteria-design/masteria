import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCheck, Calendar, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { toast } from "@/hooks/use-toast";

export function MessageViewer() {
  const { currentOrganization } = useOrganization();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ chatsCount: number; messagesCount: number } | null>(null);

  const markMessagesAsRead = async () => {
    if (!currentOrganization?.id || !startDate || !endDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione a data inicial e final",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Find all inbound messages from leads (is_from_user = FALSE means FROM leads in this schema)
      // and get unique chat_ids
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("chat_id, created_at")
        .eq("organization_id", currentOrganization.id)
        .eq("is_from_user", false)  // FALSE = messages FROM leads (inbound)
        .eq("private", false)
        .gte("created_at", startDateTime.toISOString())
        .lte("created_at", endDateTime.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000);

      if (messagesError) throw messagesError;

      if (!messages || messages.length === 0) {
        toast({
          title: "Nenhuma mensagem encontrada",
          description: "Não há mensagens de leads no período selecionado",
        });
        setLoading(false);
        return;
      }

      // Get unique chat_ids
      const uniqueChatIds = [...new Set(messages.map(msg => msg.chat_id))];

      // Batch upsert all chat reads at once instead of sequential loop
      const now = new Date().toISOString();
      
      const upsertRecords = uniqueChatIds.map(chatId => ({
        chat_id: chatId,
        user_id: user.id,
        organization_id: currentOrganization.id,
        last_seen_at: now,
        updated_at: now,
      }));

      // Process in batches of 500 to avoid payload limits
      const BATCH_SIZE = 500;
      for (let i = 0; i < upsertRecords.length; i += BATCH_SIZE) {
        const batch = upsertRecords.slice(i, i + BATCH_SIZE);
        const { error: upsertError } = await supabase
          .from("chat_reads")
          .upsert(batch, { onConflict: 'chat_id,user_id' });
        
        if (upsertError) {
          console.error("Batch upsert error:", upsertError);
          throw upsertError;
        }
      }

      setResult({
        chatsCount: uniqueChatIds.length,
        messagesCount: messages.length,
      });

      toast({
        title: "Notificações removidas!",
        description: `${uniqueChatIds.length} conversas marcadas como lidas`,
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      toast({
        title: "Erro ao marcar mensagens",
        description: "Ocorreu um erro ao processar as mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellOff className="h-5 w-5 text-primary" />
          🔕 Limpar Notificações de Mensagens
        </CardTitle>
        <CardDescription>
          Marque como lidas todas as mensagens recebidas de leads em um período específico, removendo os badges de notificação da aba de chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="startDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data Inicial
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor="endDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Data Final
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button 
            onClick={markMessagesAsRead} 
            disabled={loading} 
            className="min-w-[200px]"
            variant="default"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar como Lidas
              </>
            )}
          </Button>
        </div>

        {/* Resultado */}
        {result && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <CheckCheck className="h-5 w-5" />
              <span className="font-medium">Notificações removidas com sucesso!</span>
            </div>
            <div className="mt-2 flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {result.chatsCount} conversas
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {result.messagesCount} mensagens
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Atualize a página de Chat para ver as notificações atualizadas
            </p>
          </div>
        )}

        {/* Explicação */}
        <div className="p-4 rounded-lg bg-muted/50 border">
          <h4 className="font-medium mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Selecione o período de datas desejado</li>
            <li>• Todas as mensagens recebidas de leads nesse período serão marcadas como lidas</li>
            <li>• Os badges de notificação (números vermelhos) desaparecerão da aba de Chat</li>
            <li>• Notas internas (mensagens privadas) são ignoradas</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
