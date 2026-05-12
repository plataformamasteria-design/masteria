import { useState, useEffect, useRef } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ApiDocSidebar, sections } from "@/components/developer/ApiDocSidebar";
import { CredentialsSection } from "@/components/developer/CredentialsSection";
import { OrganizationIds } from "@/components/developer/OrganizationIds";
import { WebhookUrlsSection } from "@/components/developer/WebhookUrlsSection";
import { OrganizationSuperNode } from "@/components/developer/OrganizationSuperNode";
import { ApiSection } from "@/components/developer/ApiSection";
import { ApiEndpointCard } from "@/components/developer/ApiEndpointCard";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { SystemWebhooksConfig } from "@/components/developer/SystemWebhooksConfig";
import { AutoMessagesSettings } from "@/components/developer/AutoMessagesSettings";
import { LogoUploader } from "@/components/developer/LogoUploader";
import { WebhookManager } from "@/components/developer/WebhookManager";
import { MessageViewer } from "@/components/developer/MessageViewer";
import { MetaConnectionSettings } from "@/components/developer/MetaConnectionSettings";
import { getApiDocumentation, getSchemaInfo } from "@/lib/api-documentation";
import { Search, Database, Webhook, Radio, Tag, MessageSquare, Bot, Settings, Zap, BookOpen, Layers, Key, Building2, BellRing, Image, Facebook, Puzzle, Code2, Wrench } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Developer() {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState("native-channels");
  const [activeSection, setActiveSection] = useState('queries');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const projectUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jrxpjzgifyzhvwjfpofz.supabase.co';
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const organizationId = currentOrganization?.id || '';

  const apiSections = getApiDocumentation(projectUrl, anonKey, organizationId);
  const schemaInfo = getSchemaInfo();

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);

    // Only smooth scroll if inside the Api REST tab to prevent UI bugs
    if (activeTab === "api-rest") {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  useEffect(() => {
    if (activeTab !== "api-rest") return;

    const handleScroll = () => {
      const allSectionIds = sections.map(s => s.id);

      for (const id of allSectionIds) {
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100 && rect.bottom > 100) {
            setActiveSection(id);
            break;
          }
        }
      }
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('scroll', handleScroll);
      return () => content.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab]);

  const filteredSections = searchQuery
    ? apiSections.map(section => ({
      ...section,
      endpoints: section.endpoints.filter(
        ep =>
          ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          ep.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(section => section.endpoints.length > 0)
    : apiSections;

  const getSectionIcon = (id: string) => {
    const iconMap: Record<string, React.ElementType> = {
      queries: Search,
      'message-history': MessageSquare,
      mutations: Database,
      webhooks: Zap,
      realtime: Radio,
      tags: Tag,
      messages: MessageSquare,
      'human-assist': Bot,
      config: Settings,
      schema: BookOpen,
      'super-node': Layers,
      'n8n-nodes': Webhook
    };
    return iconMap[id] || Code2;
  };

  const ApiSidebarComponent = (
    <ApiDocSidebar
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  );

  return (
    <PagePermissionGuard page="developer">
      <AppShell>
        <div className="max-w-6xl mx-auto py-6 space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Hub de Integrações</h1>
            <p className="text-muted-foreground text-sm max-w-3xl">
              Gerencie chaves de API, webhooks e conecte o Vitta Hub aos seus ecossistemas de terceiros (Meta, Z-API, n8n) usando nossa arquitetura backend aberta.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b overflow-x-auto no-scrollbar scroll-smooth">
              <TabsList className="h-12 w-full justify-start bg-transparent flex-nowrap min-w-max p-0 pb-px">
                <TabsTrigger
                  value="native-channels"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 transition-colors text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Puzzle className="h-4 w-4 mr-2" />
                  Canais e Apps
                </TabsTrigger>
                <TabsTrigger
                  value="credentials"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 transition-colors text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Key className="h-4 w-4 mr-2" />
                  API & Credenciais
                </TabsTrigger>
                <TabsTrigger
                  value="webhooks"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 transition-colors text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Webhook className="h-4 w-4 mr-2" />
                  Webhooks & Eventos
                </TabsTrigger>
                <TabsTrigger
                  value="api-rest"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 transition-colors text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Code2 className="h-4 w-4 mr-2" />
                  Referência da API
                </TabsTrigger>
                <TabsTrigger
                  value="tools"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 transition-colors text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  Ferramentas & Debug
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="mt-8 animate-in fade-in duration-300">
              <TabsContent value="native-channels" className="space-y-6 mt-0 min-h-[50vh]">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                    <div className="p-6">
                      <div className="mb-6 flex items-center gap-3 border-b pb-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Facebook className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Integração Oficial Meta</h3>
                          <p className="text-xs text-muted-foreground">Facebook & Instagram Business</p>
                        </div>
                      </div>
                      <MetaConnectionSettings />
                    </div>
                  </Card>

                  <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
                    <div className="p-6">
                      <div className="mb-6 flex items-center gap-3 border-b pb-4">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <BellRing className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Mensagens Automáticas</h3>
                          <p className="text-xs text-muted-foreground">Boas-vindas e Horário de Atendimento</p>
                        </div>
                      </div>
                      <AutoMessagesSettings />
                    </div>
                  </Card>

                  <div className="col-span-1 xl:col-span-2">
                    <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                      <div className="p-6">
                        <LogoUploader />
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="credentials" className="space-y-6 mt-0 min-h-[50vh]">
                <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 to-primary"></div>
                  <div className="p-6">
                    <div className="mb-6 flex items-center gap-3 border-b pb-4">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Credenciais de Ambiente</h3>
                        <p className="text-xs text-muted-foreground">Tokens para comunicação HTTP</p>
                      </div>
                    </div>
                    <CredentialsSection
                      projectUrl={projectUrl}
                      anonKey={anonKey}
                      organizationId={organizationId}
                      organizationName={currentOrganization?.name}
                    />
                  </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-500 to-slate-400"></div>
                    <div className="p-6">
                      <div className="mb-6 flex items-center gap-3 border-b pb-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
                          <Layers className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Super Node</h3>
                          <p className="text-xs text-muted-foreground">Consulta consolidada da organização</p>
                        </div>
                      </div>
                      <OrganizationSuperNode
                        organizationId={organizationId}
                        projectUrl={projectUrl}
                        anonKey={anonKey}
                      />
                    </div>
                  </Card>

                  <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                    <div className="p-6">
                      <div className="mb-6 flex items-center gap-3 border-b pb-4">
                        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-cyan-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">IDs & Recursos</h3>
                          <p className="text-xs text-muted-foreground">Identificadores para mutations e queries</p>
                        </div>
                      </div>
                      <OrganizationIds organizationId={organizationId} />
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="webhooks" className="space-y-6 mt-0 min-h-[50vh]">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <div className="space-y-6">
                    <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                      <div className="p-6">
                        <div className="mb-6 flex items-center gap-3 border-b pb-4">
                          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <Webhook className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Inbound Webhooks</h3>
                            <p className="text-xs text-muted-foreground">Instâncias prontas (Evolution/Z-API)</p>
                          </div>
                        </div>
                        <WebhookUrlsSection
                          projectUrl={projectUrl}
                          organizationId={organizationId}
                        />
                      </div>
                    </Card>
                    <SystemWebhooksConfig />
                  </div>
                  <div>
                    <Card className="shadow-lg border-border/40 bg-card/80 backdrop-blur-md overflow-hidden relative">
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 to-purple-500"></div>
                      <div className="p-6">
                        <div className="mb-6 flex items-center gap-3 border-b pb-4">
                          <div className="h-10 w-10 rounded-xl bg-fuchsia-500/10 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-fuchsia-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Webhooks Customizados</h3>
                            <p className="text-xs text-muted-foreground">Eventos acionados pela plataforma</p>
                          </div>
                        </div>
                        <WebhookManager />
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="api-rest" className="space-y-0 mt-0 h-[calc(100vh-220px)] border border-border/60 rounded-xl overflow-hidden bg-background/50 backdrop-blur-md flex flex-col md:flex-row shadow-sm">
                {isMobile ? (
                  <div className="border-b border-border/60 p-4 flex justify-between items-center bg-card/80">
                    <span className="font-semibold text-sm">Documentação da API</span>
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 shadow-sm">
                          <Menu className="h-4 w-4 mr-2" /> Conteúdo
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0 w-72">
                        {ApiSidebarComponent}
                      </SheetContent>
                    </Sheet>
                  </div>
                ) : (
                  ApiSidebarComponent
                )}

                <div ref={contentRef} className="flex-1 overflow-y-auto scroll-smooth">
                  <div className="p-6 md:p-10 space-y-16 pb-32 max-w-4xl mx-auto">
                    {/* Dynamic API Sections */}
                    {filteredSections.map((section, index) => (
                      <section key={section.id} id={section.id}>
                        <ApiSection
                          id={`${section.id}-content`}
                          title={section.title}
                          description={section.description}
                          icon={getSectionIcon(section.id)}
                        >
                          <div className="space-y-4">
                            {section.endpoints.map((endpoint) => (
                              <ApiEndpointCard
                                key={endpoint.id}
                                endpoint={endpoint}
                              />
                            ))}
                          </div>
                        </ApiSection>
                        {index < filteredSections.length - 1 && <Separator className="opacity-30 mt-16" />}
                      </section>
                    ))}

                    <Separator className="opacity-30" />

                    {/* Schema Reference */}
                    <section id="schema">
                      <ApiSection
                        id="schema-content"
                        title="Database Schema"
                        description="Estrutura de tabelas base do sistema para leitura via Banco ou API"
                        icon={BookOpen}
                      >
                        <CodeBlock
                          code={schemaInfo}
                          language="typescript"
                          title="Tables Reference"
                          showLineNumbers
                        />
                      </ApiSection>
                    </section>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="tools" className="space-y-6 mt-0 min-h-[50vh]">
                <Card className="border-border/40 shadow-sm glass">
                  <MessageViewer />
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </AppShell>
    </PagePermissionGuard>
  );
}
