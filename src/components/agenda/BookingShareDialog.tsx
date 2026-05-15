import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Link2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Calendar {
  id: string;
  name: string;
  isGeneral: boolean;
  color: string;
  orderPosition: number;
}

interface BookingShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: Calendar[];
  selectedCalendarId: string | null;
}

export function BookingShareDialog({ open, onOpenChange, calendars, selectedCalendarId }: BookingShareDialogProps) {
  const { currentOrganization } = useOrganization();
  const [orgSlug, setOrgSlug] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [chosenCalendarId, setChosenCalendarId] = useState<string>("all");

  useEffect(() => {
    if (open && currentOrganization?.id) {
      loadOrgSlug();
      if (selectedCalendarId) {
        const cal = calendars.find(c => c.id === selectedCalendarId);
        if (cal && !cal.isGeneral) {
          setChosenCalendarId(selectedCalendarId);
        } else {
          setChosenCalendarId("all");
        }
      }
    }
  }, [open, currentOrganization?.id, selectedCalendarId]);

  const loadOrgSlug = async () => {
    if (!currentOrganization?.id) return;
    const { data } = await (supabase as any)
      .from("organizations")
      .select("slug")
      .eq("id", currentOrganization.id)
      .maybeSingle();
    if (data) setOrgSlug(data.slug);
  };

  const nonGeneralCalendars = calendars.filter(c => !c.isGeneral);

  const bookingLink = orgSlug
    ? chosenCalendarId !== "all"
      ? `${window.location.origin}/a/${orgSlug}?c=${chosenCalendarId}`
      : `${window.location.origin}/a/${orgSlug}`
    : "";

  const getEmbedCode = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const projectId = supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : "jrxpjzgifyzhvwjfpofz";
    const apiUrl = `https://${projectId}.supabase.co/functions/v1/public-booking-api`;
    const widgetUrl = `https://${projectId}.supabase.co/functions/v1/booking-widget-js`;
    const calAttr = chosenCalendarId !== "all" ? ` data-calendar-id="${chosenCalendarId}"` : "";
    return `<!-- Widget de Agendamento -->\n<div data-booking-widget="${orgSlug}"${calAttr}></div>\n<script>\n  window.BOOKING_API_URL = '${apiUrl}';\n</script>\n<script src="${widgetUrl}" defer></script>`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(bookingLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Link copiado!");
  };

  const copyWidget = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopiedWidget(true);
    setTimeout(() => setCopiedWidget(false), 2000);
    toast.success("Código copiado!");
  };

  const selectedCalName = chosenCalendarId !== "all"
    ? nonGeneralCalendars.find(c => c.id === chosenCalendarId)?.name
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link &amp; Widget de Agendamento
          </DialogTitle>
          <DialogDescription>
            Copie o link ou o código do widget para integrar em sites externos
          </DialogDescription>
        </DialogHeader>

        {/* Calendar selector */}
        {nonGeneralCalendars.length > 0 && (
          <div className="space-y-2 mt-2">
            <Label>Agenda</Label>
            <Select value={chosenCalendarId} onValueChange={setChosenCalendarId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Geral (todas as agendas)</SelectItem>
                {nonGeneralCalendars.map(cal => (
                  <SelectItem key={cal.id} value={cal.id}>{cal.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedCalName
                ? `Link e widget exclusivos para a agenda "${selectedCalName}"`
                : "Link e widget para todas as agendas"}
            </p>
          </div>
        )}

        <Tabs defaultValue="link" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link">Link</TabsTrigger>
            <TabsTrigger value="widget">Widget</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Link de Agendamento</Label>
              <p className="text-sm text-muted-foreground">
                Compartilhe este link para que clientes agendem diretamente
              </p>
              {orgSlug ? (
                <div className="relative">
                  <div className="bg-muted p-4 rounded-lg text-sm font-mono break-all pr-14">
                    {bookingLink}
                  </div>
                  <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={copyLink}>
                    {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Carregando...</p>
              )}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2">💡 Dica</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Envie este link por WhatsApp, e-mail ou redes sociais</li>
                <li>• Cada agenda possui seu próprio link exclusivo</li>
                <li>• O link só funciona se o widget estiver ativo</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="widget" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Código de Integração</Label>
              <p className="text-sm text-muted-foreground">
                Copie e cole este código no HTML do seu site ou WordPress
              </p>
              <div className="relative">
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap pr-14">
                  {getEmbedCode()}
                </pre>
                <Button variant="outline" size="sm" className="absolute top-2 right-2" onClick={copyWidget}>
                  {copiedWidget ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <ExternalLink className="h-4 w-4" />
                Como usar
              </h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Copie o código acima</li>
                <li>Cole no HTML da página onde deseja o widget</li>
                <li>Para WordPress, use um bloco "HTML Personalizado"</li>
                <li>O widget carregará automaticamente com suas configurações</li>
              </ol>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg">
              <h4 className="font-medium mb-2">⚠️ Importante</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• O slug da organização é: <code className="bg-muted px-1 rounded">{orgSlug}</code></li>
                <li>• O widget só funciona se estiver ativo</li>
                <li>• Novos agendamentos aparecerão na sua Agenda</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
