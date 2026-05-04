// src/components/campaigns/report/campaign-report.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ReportStatsCards } from '@/components/analytics/report-stats-cards';
import { ReportStatusChart } from '@/components/campaigns/report/report-status-chart';
import { ReportMessagePreview } from '@/components/campaigns/report/report-message-preview';
import { ReportContactsTable } from '@/components/campaigns/report/report-contacts-table';
import type { Campaign, CampaignSend } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useCampaignWebSocket } from '@/hooks/use-campaign-websocket';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const ReportSkeleton = (): JSX.Element => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Skeleton className="lg:col-span-1 h-80" />
      <Skeleton className="lg:col-span-2 h-80" />
    </div>
    <Skeleton className="h-96" />
  </div>
)

interface CampaignReportProps {
  campaignId: string;
}


export function CampaignReport({ campaignId }: CampaignReportProps): JSX.Element {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [deliveryReports, setDeliveryReports] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const isSmsCampaign = campaign?.channel === 'SMS';

  const failedCount = useMemo(() => {
    return deliveryReports.filter(r =>
      r.status?.toLowerCase() === 'failed'
    ).length;
  }, [deliveryReports]);

  const canRetry = useMemo(() => {
    return failedCount > 0 && ['COMPLETED', 'PARTIAL_FAILURE', 'FAILED'].includes(campaign?.status || '');
  }, [failedCount, campaign?.status]);

  const handleRetryFailed = async () => {
    if (!campaign) return;

    setRetrying(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/retry-failed`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.description || data.error || 'Erro ao criar campanha de reenvio');
      }

      notify.success('Campanha de reenvio criada!', data.message);

      router.push(`/campaigns/${data.campaignId}/report`);
    } catch (error) {
      notify.error('Erro ao reenviar', (error as Error).message);
    } finally {
      setRetrying(false);
    }
  };

  // NOVO: WebSocket para atualizações em tempo real
  useCampaignWebSocket(
    campaignId,
    (data) => {
      // Atualizar campanha com WebSocket
      setCampaign(prev => prev ? {
        ...prev,
        sent: data.sent,
        delivered: data.delivered,
        read: data.read,
        failed: data.failed,
        status: data.status,
      } : null);
    },
    (data) => {
      // Atualizar delivery reports com WebSocket
      if (data.status === 'delivered' || data.status === 'read' || data.status === 'sent' || data.status === 'failed') {
        setDeliveryReports(prev => prev.map(report =>
          report.id === data.reportId ? { ...report, status: data.status as any } : report
        ));
      }
    }
  );

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    const fetchCampaignData = async (): Promise<void> => {
      setLoading(true);
      try {
        const [campaignRes, reportRes] = await Promise.all([
          fetch(`/api/v1/campaigns/${campaignId}`),
          fetch(`/api/v1/campaigns/${campaignId}/delivery-report`)
        ]);

        if (campaignRes.status === 404) notFound();
        if (!campaignRes.ok) throw new Error('Falha ao buscar os dados da campanha.');
        if (!reportRes.ok) throw new Error('Falha ao buscar o relatório de entrega.');

        const campaignData: Campaign = await campaignRes.json();
        const reportData: CampaignSend[] = await reportRes.json();

        setCampaign(campaignData);
        setDeliveryReports(reportData);

        // Fetch media asset if present
        if (campaignData.mediaAssetId) {
          try {
            const mediaRes = await fetch(`/api/v1/media/${campaignData.mediaAssetId}`);
            if (mediaRes.ok) {
              const mediaData = await mediaRes.json();
              setMediaUrl(mediaData.s3Url || null);
            }
          } catch (err) {
            console.error('Erro ao buscar mídia:', err);
          }
        }

      } catch (error) {
        notify.error('Erro ao carregar relatório', (error as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void fetchCampaignData();
  }, [campaignId, notify]);

  if (loading) {
    return <ReportSkeleton />;
  }

  if (!campaign) {
    return <div className="text-center py-10">Relatório não encontrado.</div>;
  }

  const campaignDate = campaign.sentAt || campaign.scheduledAt;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Relatório: ${campaign.name}`}
        description={campaignDate ? `Análise detalhada da campanha enviada em ${new Date(campaignDate).toLocaleString('pt-BR')}.` : 'Análise detalhada da campanha.'}
      >
        <div className="flex items-center gap-2">
          {canRetry && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" disabled={retrying}>
                  {retrying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reenviar {failedCount} Falhas
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reenviar mensagens que falharam?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Será criada uma nova campanha com os {failedCount} contatos que falharam anteriormente.
                    A campanha original será mantida para histórico.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRetryFailed}>
                    Confirmar Reenvio
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Link href="/campaigns" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </PageHeader>

      {!isSmsCampaign && <ReportStatsCards campaign={campaign} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {!isSmsCampaign && (
          <div className="lg:col-span-1">
            <ReportStatusChart campaign={campaign} />
          </div>
        )}
        <div className={isSmsCampaign ? "lg:col-span-3" : "lg:col-span-2"}>
          <ReportMessagePreview campaign={campaign} mediaUrl={mediaUrl} />
        </div>
      </div>

      <ReportContactsTable deliveryReports={deliveryReports} />

    </div>
  );
}
