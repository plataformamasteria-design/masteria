import { useState } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import FunnelBuilder from "@/components/pipeline/FunnelBuilder";
import InlineTagManager from "@/components/pipeline/InlineTagManager";
import TagGroupsDialog from "@/components/pipeline/TagGroupsDialog";
import { MessageTagRulesDialog } from "@/components/pipeline/MessageTagRulesDialog";
import { Button } from "@/components/ui/button";
import { Folder, MessageSquareText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

const Pipeline = () => {
  const { t } = useTranslation();
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [messageRulesOpen, setMessageRulesOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell>
      <PagePermissionGuard page="pipeline">
        <div className="space-y-8 pb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                {t('pipeline.title')}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base mt-1 italic">
                {t('pipeline.subtitle')}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setGroupsDialogOpen(true)}
                variant="outline"
                size="sm"
                className="h-10 gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
              >
                <Folder className="h-4 w-4 text-primary" />
                <span>{t('pipeline.tagGroups')}</span>
              </Button>
              <Button
                onClick={() => setMessageRulesOpen(true)}
                variant="outline"
                size="sm"
                className="h-10 gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
              >
                <MessageSquareText className="h-4 w-4 text-primary" />
                <span>{t('pipeline.tracking')}</span>
              </Button>
            </div>
          </div>

          <div className="grid gap-8">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-primary/10 text-primary">🏷️</span>
                  Gestão de Etiquetas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <InlineTagManager onTagsUpdated={() => setRefreshKey((k) => k + 1)} />
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-4 py-1 rounded-full border bg-muted/30">
                  {t('pipeline.createAnalytics')}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              </div>

              <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
                <FunnelBuilder key={refreshKey} />
              </div>
            </div>
          </div>
        </div>

        <TagGroupsDialog
          open={groupsDialogOpen}
          onOpenChange={setGroupsDialogOpen}
          onGroupsUpdated={() => setRefreshKey((k) => k + 1)}
        />
        <MessageTagRulesDialog
          open={messageRulesOpen}
          onOpenChange={setMessageRulesOpen}
        />
      </PagePermissionGuard>
    </AppShell>
  );
};

export default Pipeline;