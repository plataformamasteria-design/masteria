import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, Users } from "lucide-react";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { cn } from "@/lib/utils";

interface TopClientsProps {
  dateRange: DateRange;
}

interface ClientRevenue {
  chat_id: string;
  total: number;
  count: number;
  chat: {
    wa_name: string | null;
    phone: string;
    wa_photo_url: string | null;
    is_group?: boolean;
    group_name?: string | null;
    group_photo_url?: string | null;
  };
}

function TopClientsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-6 w-6 bg-muted animate-pulse rounded" />
            <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-5 w-20 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TopClients({ dateRange }: TopClientsProps) {
  const [clients, setClients] = useState<ClientRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTopClients();
    }

    const channel = supabase
      .channel('top-clients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTopClients)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, currentOrganization?.id]);

  const fetchTopClients = async () => {
    try {
      setLoading(true);
      
      if (!currentOrganization?.id) return;

      let query = supabase
        .from('transactions')
        .select(`
          chat_id,
          amount,
          chats (
            wa_name,
            phone,
            wa_photo_url,
            is_group,
            group_name,
            group_photo_url
          )
        `)
        .eq('organization_id', currentOrganization.id);

      if (dateRange.from) {
        query = query.gte('purchase_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange.to) {
        query = query.lte('purchase_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      
      if (error) throw error;

      const grouped = (data || []).reduce((acc, t) => {
        if (!acc[t.chat_id]) {
          acc[t.chat_id] = {
            chat_id: t.chat_id,
            total: 0,
            count: 0,
            chat: t.chats,
          };
        }
        acc[t.chat_id].total += Number(t.amount);
        acc[t.chat_id].count += 1;
        return acc;
      }, {} as Record<string, ClientRevenue>);

      const sorted = Object.values(grouped)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setClients(sorted);
    } catch (error) {
      console.error('Error fetching top clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="h-5 w-5 flex items-center justify-center text-sm text-muted-foreground font-medium">{index + 1}</span>;
  };

  if (loading) {
    return <TopClientsSkeleton />;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Clientes
        </CardTitle>
        <CardDescription>Maiores compradores do período</CardDescription>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nenhuma transação no período
          </div>
        ) : (
          <div className="space-y-3">
            {clients.map((client, index) => {
              const isGroup = client.chat?.is_group || false;
              const displayName = isGroup 
                ? (client.chat?.group_name || client.chat?.phone || 'Sem nome')
                : (client.chat?.wa_name || 'Sem nome');
              const photoUrl = isGroup 
                ? client.chat?.group_photo_url 
                : client.chat?.wa_photo_url;

              return (
                <div 
                  key={client.chat_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    "hover:bg-muted/50 cursor-pointer transition-all duration-200",
                    "border border-transparent hover:border-border",
                    index === 0 && "bg-gradient-to-r from-yellow-500/10 to-amber-500/5"
                  )}
                  onClick={() => navigate(`/chat?id=${client.chat_id}`)}
                >
                  <div className="w-6 flex justify-center">
                    {getRankIcon(index)}
                  </div>
                  <LeadAvatar
                    isGroup={isGroup}
                    photoUrl={photoUrl}
                    name={displayName}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isGroup && <Users className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                      <span className="font-medium truncate">{displayName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {client.count} {client.count === 1 ? 'compra' : 'compras'}
                    </div>
                  </div>
                  <div className="font-bold text-green-600">
                    R$ {client.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}