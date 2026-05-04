
'use client';

import { use } from 'react';
import { CampaignReport } from "@/components/campaigns/report/campaign-report";
import type { PageProps } from "@/lib/types";

export default function CampaignReportPage({ params }: PageProps<{ campaignId: string }>) {
  const { campaignId } = use(params);
  return <CampaignReport campaignId={campaignId} />;
}
