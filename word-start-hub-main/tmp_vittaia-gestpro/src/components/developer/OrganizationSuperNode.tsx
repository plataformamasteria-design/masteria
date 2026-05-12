import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "./CodeBlock";
import { 
  Layers, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight,
  Server,
  Key,
  Users,
  Tag,
  UsersRound,
  BarChart3,
  Webhook,
  Link2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface OrganizationSuperNodeProps {
  organizationId: string;
  projectUrl: string;
  anonKey: string;
}

interface SuperNodeData {
  success: boolean;
  data: {
    api_config: {
      base_url: string;
      api_key: string;
      organization_id: string;
      organization_name: string;
      organization_slug: string;
      plan: string;
      active: boolean;
    };
    evolution_api: {
      url: string | null;
      api_key: string | null;
      instance_name: string | null;
      webhook_url: string | null;
    };
    webhooks: Record<string, {
      id: string;
      name: string;
      url: string;
      active: boolean;
    }>;
    organization_ids: {
      tags: Array<{ id: string; name: string; color: string; icon?: string }>;
      users: Array<{ id: string; full_name: string; email: string }>;
      teams: Array<{ id: string; name: string; member_count: number }>;
    };
    stats: {
      total_chats: number;
      total_messages: number;
      active_today: number;
    };
    endpoints: Record<string, string>;
    created_at: string;
    updated_at: string;
  };
}

export function OrganizationSuperNode({ 
  organizationId, 
  projectUrl, 
  anonKey 
}: OrganizationSuperNodeProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SuperNodeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    api_config: true,
    evolution_api: true,
    webhooks: true,
    organization_ids: true,
    stats: true,
    endpoints: true
  });

  const fetchSuperNode = async () => {
    if (!organizationId) {
      toast.error("Organization ID não encontrado");
      return;
    }

    setLoading(true);
    try {
      // Use fetch directly since we need query params
      const response = await fetch(
        `${projectUrl}/functions/v1/organization-info?organization_id=${organizationId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonData = await response.json();
      setData(jsonData);
      toast.success("Super Node carregado com sucesso!");
    } catch (error: any) {
      console.error('Error fetching super node:', error);
      toast.error(`Erro ao carregar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!data) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast.success("JSON copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erro ao copiar");
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const curlExample = `curl -X GET "${projectUrl}/functions/v1/organization-info?organization_id=${organizationId}" \\
  -H "Authorization: Bearer ${anonKey}" \\
  -H "apikey: ${anonKey}" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Super Node</CardTitle>
                <CardDescription>
                  Informações consolidadas da organização em uma única requisição
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              GET
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={fetchSuperNode} 
              disabled={loading || !organizationId}
              className="gap-2"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              {loading ? "Carregando..." : "Gerar Super Node"}
            </Button>
            
            {data && (
              <Button variant="outline" onClick={copyAll} className="gap-2">
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copiar JSON
              </Button>
            )}
          </div>

          {/* cURL Example */}
          <CodeBlock
            code={curlExample}
            language="bash"
            title="Exemplo cURL"
            method="GET"
          />
        </CardContent>
      </Card>

      {/* Response Data */}
      {data && (
        <div className="space-y-4">
          {/* API Config */}
          <CollapsibleSection
            title="API Config"
            icon={Server}
            isOpen={expandedSections.api_config}
            onToggle={() => toggleSection('api_config')}
            badge={data.data.api_config.plan}
          >
            <div className="grid gap-2 text-sm">
              <InfoRow label="Base URL" value={data.data.api_config.base_url} copyable />
              <InfoRow label="API Key" value={data.data.api_config.api_key} copyable truncate />
              <InfoRow label="Organization ID" value={data.data.api_config.organization_id} copyable />
              <InfoRow label="Nome" value={data.data.api_config.organization_name} />
              <InfoRow label="Slug" value={data.data.api_config.organization_slug} />
              <InfoRow label="Plano" value={data.data.api_config.plan || 'N/A'} />
              <InfoRow label="Ativo" value={data.data.api_config.active ? 'Sim' : 'Não'} />
            </div>
          </CollapsibleSection>

          {/* Evolution API */}
          <CollapsibleSection
            title="Evolution API"
            icon={Key}
            isOpen={expandedSections.evolution_api}
            onToggle={() => toggleSection('evolution_api')}
            badge={data.data.evolution_api.instance_name || undefined}
          >
            <div className="grid gap-2 text-sm">
              <InfoRow label="URL" value={data.data.evolution_api.url} copyable />
              <InfoRow label="API Key" value={data.data.evolution_api.api_key} copyable truncate />
              <InfoRow label="Instance Name" value={data.data.evolution_api.instance_name} />
              <InfoRow label="Webhook URL" value={data.data.evolution_api.webhook_url} copyable />
            </div>
          </CollapsibleSection>

          {/* Webhooks */}
          <CollapsibleSection
            title="Webhooks"
            icon={Webhook}
            isOpen={expandedSections.webhooks}
            onToggle={() => toggleSection('webhooks')}
            badge={`${Object.keys(data.data.webhooks).length}`}
          >
            {Object.entries(data.data.webhooks).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.data.webhooks).map(([type, wh]) => (
                  <div key={type} className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{wh.name}</span>
                      <Badge variant={wh.active ? "default" : "secondary"} className="text-xs">
                        {wh.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <InfoRow label="Tipo" value={type} />
                    <InfoRow label="URL" value={wh.url} copyable />
                    <InfoRow label="ID" value={wh.id} copyable />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum webhook configurado</p>
            )}
          </CollapsibleSection>

          {/* Organization IDs */}
          <CollapsibleSection
            title="IDs da Organização"
            icon={Tag}
            isOpen={expandedSections.organization_ids}
            onToggle={() => toggleSection('organization_ids')}
          >
            <div className="space-y-4">
              {/* Tags */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Tags ({data.data.organization_ids.tags.length})</span>
                </div>
                <div className="space-y-1">
                  {data.data.organization_ids.tags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm flex-1">{tag.name}</span>
                      <code className="text-xs text-muted-foreground font-mono">{tag.id}</code>
                      <CopyButton value={tag.id} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Users */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Usuários ({data.data.organization_ids.users.length})</span>
                </div>
                <div className="space-y-1">
                  {data.data.organization_ids.users.map(user => (
                    <div key={user.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <span className="text-sm flex-1">{user.full_name || user.email}</span>
                      <code className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 18)}...</code>
                      <CopyButton value={user.id} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Teams */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <UsersRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Equipes ({data.data.organization_ids.teams.length})</span>
                </div>
                <div className="space-y-1">
                  {data.data.organization_ids.teams.length > 0 ? (
                    data.data.organization_ids.teams.map(team => (
                      <div key={team.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                        <span className="text-sm flex-1">{team.name}</span>
                        <Badge variant="secondary" className="text-xs">{team.member_count} membros</Badge>
                        <code className="text-xs text-muted-foreground font-mono">{team.id.slice(0, 18)}...</code>
                        <CopyButton value={team.id} />
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm p-2">Nenhuma equipe</p>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Stats */}
          <CollapsibleSection
            title="Estatísticas"
            icon={BarChart3}
            isOpen={expandedSections.stats}
            onToggle={() => toggleSection('stats')}
          >
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{data.data.stats.total_chats}</p>
                <p className="text-xs text-muted-foreground">Total Chats</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{data.data.stats.total_messages}</p>
                <p className="text-xs text-muted-foreground">Total Mensagens</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{data.data.stats.active_today}</p>
                <p className="text-xs text-muted-foreground">Ativos Hoje</p>
              </div>
            </div>
          </CollapsibleSection>

          {/* Endpoints */}
          <CollapsibleSection
            title="Endpoints Disponíveis"
            icon={Link2}
            isOpen={expandedSections.endpoints}
            onToggle={() => toggleSection('endpoints')}
          >
            <div className="space-y-1">
              {Object.entries(data.data.endpoints).map(([name, url]) => (
                <InfoRow key={name} label={name} value={url} copyable />
              ))}
            </div>
          </CollapsibleSection>

          {/* Full JSON Response */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>Resposta JSON Completa</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={JSON.stringify(data, null, 2)}
                language="json"
                showLineNumbers
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Helper Components
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  isOpen, 
  onToggle, 
  badge, 
  children 
}: {
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/50">
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Icon className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
              </div>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InfoRow({ 
  label, 
  value, 
  copyable, 
  truncate 
}: { 
  label: string; 
  value: string | null | undefined; 
  copyable?: boolean;
  truncate?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/50 italic">N/A</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <code className={cn(
          "text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded",
          truncate ? "max-w-[200px] truncate" : "break-all"
        )}>
          {value}
        </code>
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="h-6 w-6 shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        copy();
      }}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </Button>
  );
}
