import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, FileText, History, List } from "lucide-react";
import { NewCampaignTab } from "./NewCampaignTab";
import { MessageTemplatesTab } from "./MessageTemplatesTab";
import { CampaignHistoryTab } from "./CampaignHistoryTab";
import { BroadcastListsTab } from "./BroadcastListsTab";
import { cn } from "@/lib/utils";

export function BroadcastManager() {
  const [activeTab, setActiveTab] = useState("new");
  const [prefillCampaign, setPrefillCampaign] = useState<any>(null);

  const handleRepeatCampaign = (campaign: any) => {
    setPrefillCampaign(campaign);
    setActiveTab("new");
  };

  return (
    <div className="min-h-screen">
      <div className={cn(
        "w-full py-6 space-y-6 transition-all duration-300",
        activeTab === "new" ? "lg:w-[50%] lg:pr-8" : "w-full"
      )}>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie mensagens em massa para listas, etiquetas, funis ou toda a base
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="new" className="gap-2">
              <Send className="h-4 w-4" />
              Novo Disparo
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Modelos
            </TabsTrigger>
            <TabsTrigger value="lists" className="gap-2">
              <List className="h-4 w-4" />
              Listas
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-0">
            <NewCampaignTab prefillCampaign={prefillCampaign} onPrefillConsumed={() => setPrefillCampaign(null)} />
          </TabsContent>
          <TabsContent value="templates" className="mt-0">
            <MessageTemplatesTab />
          </TabsContent>
          <TabsContent value="lists" className="mt-0">
            <BroadcastListsTab />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <CampaignHistoryTab onRepeatCampaign={handleRepeatCampaign} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
