import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff, Key, Link, Building2, Terminal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CredentialItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
  sensitive?: boolean;
  mono?: boolean;
}

function CredentialItem({ icon: Icon, label, value, sensitive = false, mono = true }: CredentialItemProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!sensitive);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast({ title: `${label} copiado!` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-stretch gap-3 p-3 rounded-xl bg-muted/40 border border-border/40 hover:border-border/60 transition-colors">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <code className={cn(
          "text-xs mt-0.5 break-all leading-relaxed",
          mono && "font-mono",
          sensitive && !revealed && "blur-sm select-none"
        )}>
          {value || 'Não configurado'}
        </code>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {sensitive && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
            onClick={() => setRevealed(!revealed)}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
          onClick={handleCopy}
          disabled={!value}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

interface CredentialsSectionProps {
  projectUrl: string;
  anonKey: string;
  organizationId: string;
  organizationName?: string;
}

export function CredentialsSection({ 
  projectUrl, 
  anonKey, 
  organizationId,
  organizationName 
}: CredentialsSectionProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <CredentialItem icon={Link} label="Base URL" value={projectUrl} />
        <CredentialItem icon={Key} label="API Key (Anon)" value={anonKey} sensitive />
        <CredentialItem icon={Building2} label={organizationName || 'Organization ID'} value={organizationId} />
      </div>

      {/* Quick example */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b border-border/30">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium text-muted-foreground">Exemplo rápido</span>
        </div>
        <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto bg-background/50">
          <code className="text-foreground/80">{`curl -X GET '${projectUrl}/functions/v1/chat-webhook?organization_id=${organizationId}' \\
  -H 'Authorization: Bearer ${anonKey.slice(0, 20)}...' \\
  -H 'Content-Type: application/json'`}</code>
        </pre>
      </div>
    </div>
  );
}
