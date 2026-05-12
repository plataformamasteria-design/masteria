import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, History } from "lucide-react";
import { supabase as supabaseOriginal } from "@/integrations/supabase/client";
const supabase = supabaseOriginal as any;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface TagHistoryDialogProps {
  chatId: string;
  chatName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEntry {
  id: string;
  action: 'assigned' | 'removed';
  assigned_at: string;
  removed_at: string | null;
  tags: {
    name: string;
    color: string;
    icon: string;
  };
}

const TagHistoryDialog = ({ chatId, chatName, open, onOpenChange }: TagHistoryDialogProps) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, chatId]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_tags_history')
      .select(`
        id,
        action,
        assigned_at,
        removed_at,
        tags (
          name,
          color,
          icon
        )
      `)
      .eq('chat_id', chatId)
      .order('assigned_at', { ascending: false });

    if (!error && data) {
      setHistory(data as HistoryEntry[]);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Etapas - {chatName}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <History className="h-12 w-12 mb-3 opacity-20" />
              <p>Nenhum histórico de etapas encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
                  <Badge 
                    style={{ 
                      backgroundColor: entry.tags.color,
                      color: '#fff'
                    }}
                    className="min-w-[120px] justify-center"
                  >
                    {entry.tags.name}
                  </Badge>
                  <span className="text-sm flex-1">
                    {entry.action === 'assigned' ? '✓ Atribuída' : '✗ Removida'}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(entry.action === 'assigned' ? entry.assigned_at : entry.removed_at!), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TagHistoryDialog;
