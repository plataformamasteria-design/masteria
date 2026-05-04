'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { CampaignTable } from '@/components/campaigns/campaign-table';
import { CreateCampaignDialog } from '@/components/campaigns/create-campaign-dialog';
import { CampaignsDashboard } from '@/components/campaigns/campaigns-dashboard';
import { BaileysCampaignTable } from '@/components/campaigns/baileys-campaign-table';
import { CreateBaileysCampaignDialog } from '@/components/campaigns/create-baileys-campaign-dialog';
import { CreateSmsCampaignDialog } from '@/components/campaigns/create-sms-campaign-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, MessageSquareText, MessageCircle, MessageSquare, FileText, PlusCircle } from 'lucide-react';

// Lazy load heavy components
const TemplatesV2Content = dynamic(() => import('@/app/(main)/templates-v2/page'), { ssr: false });

export default function CampanhasHubPage() {
    const [activeTab, setActiveTab] = useState('baileys');

    return (
        <div className="space-y-6">
            <PageHeader
                title="Campanhas"
                description="Gerencie todas as campanhas de WhatsApp, SMS e templates em um só lugar."
                icon={Send}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full h-auto grid-cols-2 sm:grid-cols-4">
                    <TabsTrigger value="baileys" className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4" />
                        Campanhas Baileys
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp-api" className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp API
                    </TabsTrigger>
                    <TabsTrigger value="sms" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Templates
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="baileys" className="mt-6">
                    <div className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <CreateBaileysCampaignDialog>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Criar Campanha Baileys
                                </Button>
                            </CreateBaileysCampaignDialog>
                        </div>
                        <BaileysCampaignTable />
                    </div>
                </TabsContent>

                <TabsContent value="whatsapp-api" className="mt-6">
                    <div className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <CreateCampaignDialog>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Criar Campanha API
                                </Button>
                            </CreateCampaignDialog>
                        </div>
                        <CampaignTable channel="WHATSAPP" />
                        <CampaignsDashboard />
                    </div>
                </TabsContent>

                <TabsContent value="sms" className="mt-6">
                    <div className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <CreateSmsCampaignDialog>
                                <Button>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Criar Campanha SMS
                                </Button>
                            </CreateSmsCampaignDialog>
                        </div>
                        <CampaignTable channel="SMS" />
                    </div>
                </TabsContent>

                <TabsContent value="templates" className="mt-6">
                    <TemplatesV2Content />
                </TabsContent>
            </Tabs>
        </div>
    );
}
