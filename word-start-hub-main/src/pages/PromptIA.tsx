import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { DynamicPromptEditor } from "@/components/developer/DynamicPromptEditor";
import { AutoMessagesSettings } from "@/components/developer/AutoMessagesSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, MessageSquare } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function PromptIA() {
  return (
    <AppShell>
      <PagePermissionGuard page="promptia">
        <div className="space-y-6 md:space-y-8">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-xl bg-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-3xl font-bold tracking-tight">Prompt I.A</h1>
              <p className="text-muted-foreground text-xs md:text-sm">
                Configure o agente de inteligência artificial da sua organização
              </p>
            </div>
          </div>

          {/* Dynamic Prompt Editor — already renders its own Card */}
          <DynamicPromptEditor />

          <Separator className="my-2" />

          {/* Auto Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Mensagens automáticas
              </CardTitle>
              <CardDescription>
                Configure boas-vindas, ausência e horários de atendimento.
              </CardDescription>
            </CardHeader>
            <AutoMessagesSettings />
          </Card>
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
}
