import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageSquare, Webhook, Tag, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getWebhookUrls } from "@/lib/api-documentation";
import { cn } from "@/lib/utils";

function WebhookUrlRow({ icon: Icon, title, url, description }: {
  icon: React.ElementType;
  title: string;
  url: string;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast({ title: "URL copiada!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30 hover:border-border/50 transition-colors">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{title}</span>
          {description && (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">— {description}</span>
          )}
        </div>
        <code className="text-[11px] font-mono text-muted-foreground break-all leading-relaxed">{url}</code>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

interface WebhookUrlsSectionProps {
  projectUrl: string;
  organizationId: string;
}

export function WebhookUrlsSection({ projectUrl, organizationId }: WebhookUrlsSectionProps) {
  const urls = getWebhookUrls(projectUrl, organizationId);

  return (
    <div className="space-y-3">
      <WebhookUrlRow icon={Zap} title="Z-API Webhook" url={urls.zapi} description="WhatsApp via Z-API" />
      <WebhookUrlRow icon={MessageSquare} title="Chat Webhook" url={urls.chat} description="CRUD de chats/leads" />
      <WebhookUrlRow icon={Webhook} title="Messages Webhook" url={urls.messages} description="Envio de mensagens" />
      <WebhookUrlRow icon={Tag} title="Tags Webhook" url={urls.tags} description="Gerenciamento de tags" />
    </div>
  );
}
