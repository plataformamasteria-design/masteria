
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Send, Clock, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { Campaign } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

export function OngoingCampaigns() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    useEffect(() => {
        const fetchCampaigns = async () => {
            setLoading(true);
            try {
                const response = await fetch('/api/v1/campaigns');
                if (!response.ok) throw new Error('Falha ao buscar campanhas.');
                const result = await response.json();
                const activeCampaigns = (result.data || []).filter((c: Campaign) => ['SENDING', 'SCHEDULED', 'QUEUED', 'PENDING'].includes(c.status)).slice(0, 3);
                setCampaigns(activeCampaigns);
            } catch (error) {
                 notify.error('Erro', (error as Error).message);
            } finally {
                setLoading(false);
            }
        };
        fetchCampaigns();
    }, [notify]);


  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Campanhas em Andamento</CardTitle>
        <CardDescription>Acompanhe os envios ativos e agendados.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
            <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        ) : campaigns.length > 0 ? campaigns.map(campaign => {
            const isSending = campaign.status === 'SENDING';
            return (
                <div key={campaign.id}>
                    <div className="flex justify-between items-center mb-1">
                        <p className="font-medium text-sm truncate">{campaign.name}</p>
                        <div className={cn("flex items-center text-xs", isSending ? "text-primary" : "text-muted-foreground")}>
                            {isSending ? <Send className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                            {isSending ? 'Enviando' : 'Agendada'}
                        </div>
                    </div>
                    {isSending && campaign.progress !== undefined ? (
                         <Progress value={campaign.progress} className="h-2" />
                    ) : (
                        <p className="text-xs text-muted-foreground">Para {campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString('pt-BR') : 'data indefinida'}</p>
                    )}
                </div>
            )
        }) : (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma campanha em andamento.</p>
        )}
      </CardContent>
    </Card>
  );
}
