
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Search,
  FileText,
  ImageIcon,
  VideoIcon,
  FileQuestion,
  MoreVertical,
  Loader2,
  Tag,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import type { Template, Connection } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { CreateWhatsappCampaignDialog } from '../campaigns/create-whatsapp-campaign-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const statusConfig = {
  APPROVED: {
    variant: 'default',
    text: 'Aprovado',
    className: 'bg-green-500 hover:bg-green-600',
  },
  PENDING: {
    variant: 'secondary',
    text: 'Pendente',
    className: 'bg-yellow-500 hover:bg-yellow-600 text-black',
  },
  REJECTED: {
    variant: 'destructive',
    text: 'Rejeitado',
    className: '',
  },
  // Fallbacks for old data
  APROVADO: { variant: 'default', text: 'Aprovado', className: 'bg-green-500 hover:bg-green-600' },
  PENDENTE: { variant: 'secondary', text: 'Pendente', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
  REJEITADO: { variant: 'destructive', text: 'Rejeitado', className: '' },
} as const;

const headerIconConfig = {
  IMAGE: <ImageIcon className="h-4 w-4" />,
  VIDEO: <VideoIcon className="h-4 w-4" />,
  DOCUMENT: <FileText className="h-4 w-4" />,
  TEXT: <FileQuestion className="h-4 w-4" />,
  NONE: null,
};

export function TemplateGrid() {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState('');
  const [isCampaignModalOpen, setCampaignModalOpen] = useState(false);
  const [templateForCampaign, setTemplateForCampaign] = useState<Template | null>(null);
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetchPrerequisites = useCallback(async () => {
    setLoading(true);
    try {
        const [connRes, tplRes] = await Promise.all([
            fetch('/api/v1/connections'),
            fetch('/api/v1/message-templates')
        ]);

        if (!connRes.ok || !tplRes.ok) {
            throw new Error('Falha ao carregar dados iniciais.');
        }

        const connData = await connRes.json();
        const tplData = await tplRes.json();
        
        setConnections(connData);
        setTemplates(tplData.templates || tplData);

        if (!activeConnectionId) {
            const firstActive = connData.find((c: Connection) => c.isActive);
            if (firstActive) {
                setActiveConnectionId(firstActive.id);
            } else if (connData.length > 0) {
                setActiveConnectionId(connData[0].id);
            }
        }

    } catch (error) {
        notify.error('Erro', (error as Error).message);
    } finally {
        setLoading(false);
    }
  }, [notify, activeConnectionId]);
  
  useEffect(() => {
    fetchPrerequisites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleSync = async () => {
    setIsSyncing(true);
    notify.info('Sincronizando modelos...', 'Aguarde enquanto buscamos os dados mais recentes.');
    try {
        const response = await fetch('/api/v1/templates/sync', { method: 'POST' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha na sincronização.');
        }
        const result = await response.json();
        notify.success('Sincronização Concluída!', result.message);
        await fetchPrerequisites(); // Recarrega tudo
    } catch (error) {
        notify.error('Erro de Sincronização', (error as Error).message);
    } finally {
        setIsSyncing(false);
    }
  }


  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(search.toLowerCase());
    
    const activeConnection = connections.find(c => c.id === activeConnectionId);
    if (!activeConnection) return false;

    const matchesConnection = template.wabaId === activeConnection.wabaId;
    return matchesSearch && matchesConnection;
  });
  
  const extractBodyText = (template: Template): string => {
    if (!template.components || !Array.isArray(template.components)) return '';
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    return bodyComponent?.text || '';
  };

  const extractHeaderType = (template: Template): string => {
    if (!template.components || !Array.isArray(template.components)) return 'NONE';
    const headerComponent = template.components.find((c: any) => c.type === 'HEADER');
    return headerComponent?.format || 'NONE';
  };

  const highlightVariables = (body: string) => {
    if (!body) return '';
    return body.split(/(\{\{.*?\}\})/).map((part, index) =>
      part.match(/(\{\{.*?\}\})/) ? (
        <span key={index} className="font-bold text-primary">
          {part}
        </span>
      ) : (
        part
      )
    );
  };
  
  const openCampaignModal = (template: Template) => {
    setTemplateForCampaign(template);
    setCampaignModalOpen(true);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="flex-1 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Label htmlFor="connection-select" className="text-sm font-medium whitespace-nowrap">Exibindo modelos para a conexão:</Label>
            <Select value={activeConnectionId} onValueChange={setActiveConnectionId} disabled={loading}>
              <SelectTrigger id="connection-select" className="w-full sm:w-[200px]">
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.config_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar modelo..."
              className="pl-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" className="whitespace-nowrap" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </div>
       <Alert className="mb-6 bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200">
            <Info className="h-4 w-4 text-blue-500" />
            <AlertTitle>Primeiro Passo</AlertTitle>
            <AlertDescription>
                Selecione um modelo de mensagem abaixo para iniciar a criação da sua campanha de WhatsApp.
            </AlertDescription>
        </Alert>
      <Dialog open={!!selectedTemplate} onOpenChange={(isOpen) => !isOpen && setSelectedTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
           <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Detalhes completos do modelo de mensagem.
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
             <div className="space-y-4 py-4 text-sm">
                <div className="space-y-1">
                  <h4 className="font-semibold">Linguagem</h4>
                  <p className="text-muted-foreground">{selectedTemplate.language}</p>
                </div>
                 <div className="space-y-1">
                  <h4 className="font-semibold">Status</h4>
                  <p className="text-muted-foreground">{statusConfig[selectedTemplate.status as keyof typeof statusConfig]?.text || selectedTemplate.status}</p>
                </div>
                 <div className="space-y-1">
                  <h4 className="font-semibold">Categoria</h4>
                  <p className="text-muted-foreground capitalize">{selectedTemplate.category.toLowerCase()}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold">Corpo do Modelo</h4>
                  <p className="text-muted-foreground p-3 bg-muted rounded-md whitespace-pre-wrap">{highlightVariables(extractBodyText(selectedTemplate))}</p>
                </div>
                {extractHeaderType(selectedTemplate) !== 'NONE' && (
                  <div className="space-y-1">
                    <h4 className="font-semibold">Tipo de Cabeçalho</h4>
                    <p className="text-muted-foreground capitalize">{extractHeaderType(selectedTemplate).toLowerCase()}</p>
                  </div>
                )}
             </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSelectedTemplate(null)}>Fechar</Button>
            {selectedTemplate && activeConnectionId && (
                <Button type="button" onClick={() => openCampaignModal(selectedTemplate)}>Criar Campanha</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {isCampaignModalOpen && (
        <CreateWhatsappCampaignDialog 
            isOpen={isCampaignModalOpen}
            onOpenChange={setCampaignModalOpen}
            connections={connections}
            templates={templates}
            isLoading={loading}
            onBack={() => {}}
            initialTemplate={templateForCampaign}
        />
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
       ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTemplates.map((template) => {
          const statusKey = template.status as keyof typeof statusConfig;
          const status = statusConfig[statusKey] || { variant: 'secondary', text: template.status };
          const headerType = extractHeaderType(template);
          const HeaderIcon = headerType !== 'NONE'
            ? headerIconConfig[headerType as keyof typeof headerIconConfig]
            : null;
          return (
            <Card key={template.id} className="flex flex-col">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedTemplate(template)}>
                      Ver Detalhes
                    </DropdownMenuItem>
                    {activeConnectionId && (
                         <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openCampaignModal(template); }}>Criar Campanha</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                 <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge variant={status.variant} className={cn(status.className)}>
                    {status.text}
                  </Badge>
                   <Badge variant="outline" className="capitalize flex items-center gap-1.5"><Tag className="h-3 w-3"/>{template.category.toLowerCase()}</Badge>
                </div>
                 <div className="flex items-center justify-start text-muted-foreground">
                   {HeaderIcon && (
                    <div className="flex items-center gap-2">
                      {HeaderIcon}
                      <span className="text-xs font-semibold">{headerType}</span>
                    </div>
                  )}
                 </div>
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md h-28 overflow-y-auto whitespace-pre-wrap">
                    {highlightVariables(extractBodyText(template))}
                </div>
              </CardContent>
              <CardFooter>
                {activeConnectionId && (
                    <Button className="w-full" onClick={() => openCampaignModal(template)}>Criar Campanha</Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
         {filteredTemplates.length === 0 && !loading && (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <p>Nenhum modelo encontrado para esta conexão.</p>
          </div>
        )}
      </div>
       )}
    </>
  );
}
