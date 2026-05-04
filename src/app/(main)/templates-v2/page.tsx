'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
  MessageSquare,
  Megaphone,
  Search,
  Send,
} from 'lucide-react';
import { TemplateBuilder } from '@/components/message-templates/template-builder';
import { CreateWhatsappCampaignDialog } from '@/components/campaigns/create-whatsapp-campaign-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { Connection, Template } from '@/lib/types';

interface MessageTemplate {
  id: string;
  name: string;
  displayName: string | null;
  metaTemplateId: string | null;
  wabaId: string;
  category: string;
  language: string;
  status: string;
  rejectedReason: string | null;
  components: any;
  connectionId: string;
  connection?: Connection;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
  approvedAt: Date | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500',
  PENDING: 'bg-yellow-500',
  APPROVED: 'bg-green-500',
  REJECTED: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

export default function TemplatesV2Page() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [connectionFilter, setConnectionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [selectedTemplateForCampaign, setSelectedTemplateForCampaign] = useState<MessageTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [selectedConnectionForCreate, setSelectedConnectionForCreate] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const isMobileDetected = useIsMobile();
  const isMobile = mounted ? isMobileDetected : false;
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (connectionFilter !== 'all') params.set('connectionId', connectionFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/v1/message-templates?${params.toString()}`);
      if (!response.ok) throw new Error('Falha ao carregar templates');

      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os templates',
      });
    } finally {
      setLoading(false);
    }
  }, [search, connectionFilter, statusFilter, toast]);

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/connections');
      if (!response.ok) throw new Error('Falha ao carregar conexões');

      const data = await response.json();
      setConnections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchTemplates();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchTemplates]);

  const handleCreateTemplate = async (data: {
    name: string;
    category: string;
    language: string;
    components: any[];
  }) => {
    if (!selectedConnectionForCreate) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma conexão',
        description: 'Você precisa selecionar uma conexão antes de criar um template',
      });
      return;
    }

    const connection = connections.find(c => c.id === selectedConnectionForCreate);
    if (!connection) {
      toast({
        variant: 'destructive',
        title: 'Conexão não encontrada',
        description: 'A conexão selecionada não foi encontrada',
      });
      return;
    }

    try {
      const response = await fetch('/api/v1/message-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          connectionId: selectedConnectionForCreate,
          wabaId: connection.connectionType === 'meta_api' ? connection.wabaId : 'baileys',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao criar template');
      }

      toast({
        title: 'Template criado',
        description: 'O template foi criado com sucesso',
      });

      setShowCreateDialog(false);
      setSelectedConnectionForCreate('');
      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar template',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  const handleSubmitTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/message-templates/${templateId}/submit`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao submeter template');
      }

      toast({
        title: 'Template submetido',
        description: 'O template foi submetido à Meta para aprovação',
      });

      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao submeter template',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  const handleSyncStatus = async (templateId: string) => {
    try {
      const response = await fetch(`/api/v1/message-templates/${templateId}/sync-status`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao sincronizar status');
      }

      toast({
        title: 'Status sincronizado',
        description: 'O status do template foi atualizado',
      });

      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao sincronizar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteId) return;

    try {
      const response = await fetch(`/api/v1/message-templates?id=${deleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao deletar template');
      }

      toast({
        title: 'Template deletado',
        description: 'O template foi removido com sucesso',
      });

      setDeleteId(null);
      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao deletar template',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  const handleViewTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setShowViewDialog(true);
  };

  const convertMessageTemplateToTemplate = (template: MessageTemplate): Template => {
    const bodyComponent = Array.isArray(template.components) 
      ? template.components.find((c: any) => c.type === 'BODY')
      : null;
    
    const headerComponent = Array.isArray(template.components)
      ? template.components.find((c: any) => c.type === 'HEADER')
      : null;
    
    const matchingConnection = connections.find(c => c.id === template.connectionId);
    
    return {
      ...template,
      connection: matchingConnection,
      body: bodyComponent?.text || '',
      headerType: (headerComponent?.format as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null) || null,
    } as Template;
  };

  const handleCreateCampaign = (template: MessageTemplate) => {
    const bodyComponent = Array.isArray(template.components) 
      ? template.components.find((c: any) => c.type === 'BODY')
      : null;
    
    if (!bodyComponent?.text) {
      toast({
        variant: 'destructive',
        title: 'Template inválido',
        description: 'Este template não possui conteúdo de mensagem (BODY). Não é possível criar uma campanha.',
      });
      return;
    }
    
    const templateForCampaign = convertMessageTemplateToTemplate(template);
    setSelectedTemplateForCampaign(templateForCampaign as any);
    setShowCampaignDialog(true);
  };

  const handleSyncTemplates = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/v1/templates/sync', { method: 'POST' });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro na sincronização');
      }
      
      toast({
        title: 'Sincronização concluída',
        description: data.message || (data.synced !== undefined 
          ? `${data.synced} templates sincronizados` 
          : 'Sincronização finalizada'),
      });
      fetchTemplates();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro na sincronização',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Templates WhatsApp</h1>
            <p className="text-muted-foreground">
              Gerencie seus templates de mensagens do WhatsApp Business
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSyncTemplates}
              disabled={syncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Meta'}
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Template
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={connectionFilter} onValueChange={setConnectionFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todas as conexões" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as conexões</SelectItem>
              {connections.map(conn => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.config_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="DRAFT">Rascunho</SelectItem>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="APPROVED">Aprovado</SelectItem>
              <SelectItem value="REJECTED">Rejeitado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Listagem */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum template encontrado</p>
            <p className="text-muted-foreground text-center mt-2">
              Comece criando seu primeiro template de mensagem WhatsApp
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <div className="grid gap-4">
          {templates.map(template => (
            <Card key={template.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium">{template.name}</h3>
                    {template.displayName && (
                      <p className="text-sm text-muted-foreground">{template.displayName}</p>
                    )}
                  </div>
                  <Badge className={STATUS_COLORS[template.status]}>
                    {STATUS_LABELS[template.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground">Categoria:</span>
                    <p className="font-medium">{template.category}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Conexão:</span>
                    <p className="font-medium truncate">
                      {template.connection?.config_name || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewTemplate(template)}
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  {(template.status === 'DRAFT' || template.status === 'REJECTED') && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSubmitTemplate(template.id)}
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Submeter
                    </Button>
                  )}
                  {template.metaTemplateId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncStatus(template.id)}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(template.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{template.name}</div>
                      {template.displayName && (
                        <div className="text-sm text-muted-foreground">
                          {template.displayName}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{template.category}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[template.status]}>
                      {STATUS_LABELS[template.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{template.connection?.config_name || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(template.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewTemplate(template)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        {template.status === 'APPROVED' && (
                          <DropdownMenuItem onClick={() => handleCreateCampaign(template)}>
                            <Megaphone className="mr-2 h-4 w-4" />
                            Criar Campanha
                          </DropdownMenuItem>
                        )}
                        {(template.status === 'DRAFT' || template.status === 'REJECTED') && (
                          <DropdownMenuItem onClick={() => handleSubmitTemplate(template.id)}>
                            <Send className="mr-2 h-4 w-4" />
                            Submeter à Meta
                          </DropdownMenuItem>
                        )}
                        {template.metaTemplateId && (
                          <DropdownMenuItem onClick={() => handleSyncStatus(template.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Sincronizar Status
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeleteId(template.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog: Criar Template */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) setSelectedConnectionForCreate('');
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Template WhatsApp</DialogTitle>
            <DialogDescription>
              Crie um template de mensagem que será aprovado pela Meta antes de poder ser usado
            </DialogDescription>
          </DialogHeader>
          
          {/* Seleção de Conexão */}
          <div className="space-y-2 pb-4 border-b">
            <label className="text-sm font-medium">
              Conexão WhatsApp <span className="text-red-500">*</span>
            </label>
            <Select 
              value={selectedConnectionForCreate} 
              onValueChange={setSelectedConnectionForCreate}
            >
              <SelectTrigger className={!selectedConnectionForCreate ? 'border-red-300' : ''}>
                <SelectValue placeholder="Selecione uma conexão para criar o template" />
              </SelectTrigger>
              <SelectContent>
                {connections.map(conn => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.config_name} ({conn.connectionType === 'meta_api' ? 'Whatsapp Business' : 'Whatsapp Normal'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedConnectionForCreate && (
              <p className="text-sm text-red-500">
                Você precisa selecionar uma conexão para criar o template
              </p>
            )}
          </div>

          <TemplateBuilder
            onSave={handleCreateTemplate}
            onCancel={() => {
              setShowCreateDialog(false);
              setSelectedConnectionForCreate('');
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver Template */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Template</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Nome</p>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <Badge className={STATUS_COLORS[selectedTemplate.status]}>
                    {STATUS_LABELS[selectedTemplate.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Categoria</p>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.category}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Idioma</p>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.language}</p>
                </div>
              </div>
              {selectedTemplate.rejectedReason && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    Motivo da Rejeição
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-200 mt-1">
                    {selectedTemplate.rejectedReason}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Preview</p>
                <div className="bg-white dark:bg-gray-900 border rounded-lg p-4 max-w-sm">
                  {Array.isArray(selectedTemplate.components) &&
                    selectedTemplate.components.map((comp: any, idx: number) => {
                      if (comp.type === 'HEADER' && comp.text) {
                        return (
                          <div key={idx} className="font-bold mb-2">
                            {comp.text}
                          </div>
                        );
                      }
                      if (comp.type === 'BODY' && comp.text) {
                        return (
                          <div key={idx} className="mb-2 whitespace-pre-wrap">
                            {comp.text}
                          </div>
                        );
                      }
                      if (comp.type === 'FOOTER' && comp.text) {
                        return (
                          <div key={idx} className="text-sm text-muted-foreground mt-2">
                            {comp.text}
                          </div>
                        );
                      }
                      return null;
                    })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Dialog: Deletar */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-600">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Criar Campanha */}
      {selectedTemplateForCampaign && (
        <CreateWhatsappCampaignDialog
          isOpen={showCampaignDialog}
          onOpenChange={setShowCampaignDialog}
          connections={connections}
          templates={templates.map(convertMessageTemplateToTemplate) as any[]}
          isLoading={loading}
          onBack={() => setShowCampaignDialog(false)}
          initialTemplate={convertMessageTemplateToTemplate(selectedTemplateForCampaign)}
        />
      )}
    </div>
  );
}
