'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { CampaignTable } from '@/components/campaigns/campaign-table';
import { CreateWhatsappCampaignWrapper } from '@/components/campaigns/create-whatsapp-campaign-wrapper';
import { CampaignsDashboard } from '@/components/campaigns/campaigns-dashboard';
import { BaileysCampaignTable } from '@/components/campaigns/baileys-campaign-table';
import { CreateBaileysCampaignDialog } from '@/components/campaigns/create-baileys-campaign-dialog';
import { CreateSmsCampaignDialog } from '@/components/campaigns/create-sms-campaign-dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, MessageSquareText, MessageCircle, MessageSquare, FileText, PlusCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

// Lazy load heavy components
const TemplatesV2Content = dynamic(() => import('@/app/(main)/templates-v2/page'), { ssr: false });

export default function CampanhasHubPage() {
    const [activeTab, setActiveTab] = useState('whatsapp');

    return (
        <div className="space-y-6">
            <PageHeader
                title="Campanhas"
                description="Gerencie todas as campanhas de WhatsApp, SMS e templates em um só lugar."
                icon={Send}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-black/5 dark:bg-white/[0.02] p-1 border border-black/5 dark:border-white/5 rounded-2xl w-fit h-auto shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] flex flex-wrap gap-1 max-w-full">
                    <TabsTrigger value="whatsapp" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="sms" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="rounded-xl px-5 py-2 text-sm font-bold transition-all data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] border border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Templates
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="whatsapp" className="mt-6">
                    <div className="space-y-6">
                        <div className="flex justify-end gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Criar Campanha
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-300 rounded-xl p-2 shadow-lg">
                                    <CreateWhatsappCampaignWrapper>
                                        <DropdownMenuItem className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-lg p-2.5 flex items-center" onSelect={(e) => e.preventDefault()}>
                                            <MessageCircle className="mr-2 h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                                            <span>WhatsApp Oficial (API)</span>
                                        </DropdownMenuItem>
                                    </CreateWhatsappCampaignWrapper>
                                    <CreateBaileysCampaignDialog>
                                        <DropdownMenuItem className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-lg p-2.5 flex items-center" onSelect={(e) => e.preventDefault()}>
                                            <MessageSquareText className="mr-2 h-4 w-4 text-blue-400" />
                                            <span>WhatsApp Não Oficial (Baileys)</span>
                                        </DropdownMenuItem>
                                    </CreateBaileysCampaignDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
