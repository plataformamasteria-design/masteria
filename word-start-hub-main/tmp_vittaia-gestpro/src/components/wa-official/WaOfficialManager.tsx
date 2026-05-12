import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, FileText, List, MessageCircle } from "lucide-react";
import { WaNewCampaignTab } from "./WaNewCampaignTab";
import { WaTemplatesTab } from "./WaTemplatesTab";
import { BroadcastListsTab } from "@/components/disparos/BroadcastListsTab";

export function WaOfficialManager() {
    const [activeTab, setActiveTab] = useState("new");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <MessageCircle className="h-6 w-6 text-green-500" /> WhatsApp Oficial (Cloud API)
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Envie campanhas via API Oficial da Meta (requer Templates aprovados)
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="new" className="gap-2">
                        <Send className="h-4 w-4" />
                        Novo Disparo
                    </TabsTrigger>
                    <TabsTrigger value="lists" className="gap-2">
                        <List className="h-4 w-4" />
                        Lista de Leads
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Modelos (Templates)
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="new">
                    <WaNewCampaignTab />
                </TabsContent>
                <TabsContent value="lists">
                    <BroadcastListsTab />
                </TabsContent>
                <TabsContent value="templates">
                    <WaTemplatesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
