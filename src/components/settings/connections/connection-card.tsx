
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Phone, Server, MoreVertical, Edit, Trash2, Webhook, Loader2, CheckCircle2, XCircle, AlertTriangle, AlertCircle, Instagram } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Connection, ConnectionStatus, WebhookStatus, HealthStatus, HmacHealthStatus } from './types';

// Configuration helpers
const connectionStatusConfig: Record<ConnectionStatus, { icon: React.ElementType, color: string, text: string }> = {
    Conectado: { icon: CheckCircle2, color: 'text-green-500', text: 'Conectado' },
    'Falha na Conexão': { icon: XCircle, color: 'text-destructive', text: 'Falha na Conexão' },
    'Não Verificado': { icon: Loader2, color: 'text-muted-foreground', text: 'Verificando...' },
};

const webhookStatusConfig: Record<WebhookStatus, { icon: React.ElementType, color: string, text: string }> = {
    CONFIGURADO: { icon: CheckCircle2, color: 'text-green-500', text: 'Webhook Configurado' },
    DIVERGENTE: { icon: AlertCircle, color: 'text-yellow-500', text: 'URL do Webhook Divergente' },
    NAO_CONFIGURADO: { icon: XCircle, color: 'text-destructive', text: 'Webhook Não Configurado' },
    ERRO: { icon: XCircle, color: 'text-destructive', text: 'Erro ao Verificar Webhook' },
    VERIFICANDO: { icon: Loader2, color: 'text-muted-foreground', text: 'Verificando Webhook...' },
};

const healthStatusConfig: Record<HealthStatus, { icon: React.ElementType, color: string, text: string, bgColor: string }> = {
    healthy: { icon: CheckCircle2, color: 'text-green-600', text: 'Saudável', bgColor: 'bg-green-50' },
    expiring_soon: { icon: AlertTriangle, color: 'text-yellow-600', text: 'Token Expira em Breve', bgColor: 'bg-yellow-50' },
    expired: { icon: AlertTriangle, color: 'text-red-600', text: 'Token Expirado', bgColor: 'bg-red-50' },
    error: { icon: XCircle, color: 'text-red-600', text: 'Erro', bgColor: 'bg-red-50' },
    inactive: { icon: AlertCircle, color: 'text-muted-foreground', text: 'Inativa', bgColor: 'bg-muted/50' },
};

const hmacHealthConfig: Record<HmacHealthStatus, { icon: React.ElementType, color: string, text: string, bgColor: string }> = {
    healthy: { icon: CheckCircle2, color: 'text-green-600', text: 'HMAC OK', bgColor: 'bg-green-50' },
    warning: { icon: AlertTriangle, color: 'text-yellow-600', text: 'HMAC Instável', bgColor: 'bg-yellow-50' },
    error: { icon: XCircle, color: 'text-red-600', text: 'HMAC Falha', bgColor: 'bg-red-50' },
    no_data: { icon: AlertCircle, color: 'text-muted-foreground', text: 'Sem Dados', bgColor: 'bg-muted/50' },
    loading: { icon: Loader2, color: 'text-muted-foreground', text: 'Verificando...', bgColor: 'bg-muted/50' },
};

interface ConnectionCardProps {
    wabaId: string;
    connections: Connection[];
    isSyncingWebhook: string | null;
    onToggleActive: (id: string, active: boolean) => void;
    onSyncWebhook: (id: string) => void;
    onEdit: (connection: Connection) => void;
    onDelete: (id: string) => void;
}

export function ConnectionCard({ wabaId, connections, isSyncingWebhook, onToggleActive, onSyncWebhook, onEdit, onDelete }: ConnectionCardProps) {
    const iconMap: Record<string, React.ElementType> = {
        'meta_api': Phone,
        'instagram': Instagram,
        'instagram_direct': Instagram,
    };
    const firstConn = connections[0];
    const Icon = firstConn?.connectionType ? (iconMap[firstConn.connectionType] || Server) : Server;

    const titleMap: Record<string, string> = {
        'meta_api': 'WhatsApp Business Account',
        'instagram': 'Instagram Graph Account',
        'instagram_direct': 'Instagram Direct Account',
    };
    const title = firstConn?.connectionType ? (titleMap[firstConn.connectionType] || 'WhatsApp Business Account') : 'WhatsApp Business Account';

    return (
        <Card className="overflow-hidden">
            <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="truncate">{title}</span>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm truncate">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate block">WABA ID: {wabaId}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-mono text-xs">{wabaId}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardDescription>
            </CardHeader>
            <CardContent className="divide-y p-3 sm:p-6 pt-0 sm:pt-0">
                {connections.map(conn => {
                    const statusInfo = connectionStatusConfig[conn.connectionStatus || 'Não Verificado'];
                    const ConnStatusIcon = statusInfo.icon;

                    const webhookInfo = webhookStatusConfig[conn.webhookStatus || 'VERIFICANDO'];
                    const WebhookStatusIcon = webhookInfo.icon;

                    const healthInfo = conn.healthStatus ? healthStatusConfig[conn.healthStatus] : null;
                    const HealthStatusIcon = healthInfo?.icon;

                    const hmacInfo = conn.hmacHealth ? hmacHealthConfig[conn.hmacHealth.status] : hmacHealthConfig['no_data'];
                    const HmacStatusIcon = hmacInfo.icon;

                    return (
                        <div key={conn.id} className="space-y-4 py-4 first:pt-0 last:pb-0">
                            <div className="flex items-start sm:items-center gap-3">
                                <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0 mt-1 sm:mt-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm sm:text-base truncate">{conn.config_name}</p>
                                        {healthInfo && conn.healthStatus !== 'healthy' && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className={cn('flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium', healthInfo.color, healthInfo.bgColor)}>
                                                            {HealthStatusIcon && React.createElement(HealthStatusIcon, { className: "h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" })}
                                                            <span className="truncate max-w-[100px] sm:max-w-none">{healthInfo.text}</span>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{conn.healthErrorMessage || 'Problema detectado na conexão'}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                        {conn.connectionType?.startsWith('instagram') ? 'User ID: ' : 'Phone ID: '}
                                        {conn.phoneNumberId}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:gap-3 mt-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={cn('flex items-center text-[10px] sm:text-xs', statusInfo.color)}>
                                                        <ConnStatusIcon className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5", conn.connectionStatus === 'Não Verificado' && 'animate-spin')} />
                                                        <span className="font-medium truncate">{statusInfo.text}</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Status da API da Meta</p></TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={cn('flex items-center text-[10px] sm:text-xs', webhookInfo.color)}>
                                                        <WebhookStatusIcon className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5", conn.webhookStatus === 'VERIFICANDO' && 'animate-spin')} />
                                                        <span className="font-medium truncate">{webhookInfo.text}</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Status do Webhook</p></TooltipContent>
                                            </Tooltip>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={cn('flex items-center text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full', hmacInfo.color, hmacInfo.bgColor)}>
                                                        <HmacStatusIcon className={cn("h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1 sm:mr-1.5", conn.hmacHealth?.status === 'loading' && 'animate-spin')} />
                                                        <span className="font-medium truncate">{hmacInfo.text}</span>
                                                        {conn.hmacHealth?.successRate !== null && conn.hmacHealth?.successRate !== undefined && (
                                                            <span className="ml-1 opacity-75">({conn.hmacHealth.successRate}%)</span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="text-xs">
                                                        <p className="font-medium">Validação HMAC em Tempo Real</p>
                                                        {conn.hmacHealth && conn.hmacHealth.successRate !== null && (
                                                            <p>Taxa de sucesso: {conn.hmacHealth.successRate}%</p>
                                                        )}
                                                        {conn.hmacHealth?.lastValidatedAt && (
                                                            <p>Última validação: {new Date(conn.hmacHealth.lastValidatedAt).toLocaleString('pt-BR')}</p>
                                                        )}
                                                        {conn.hmacHealth?.lastError && (
                                                            <p className="text-red-500">Erro: {conn.hmacHealth.lastError}</p>
                                                        )}
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                                <div className="flex items-center justify-between sm:justify-start gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id={`active-switch-${conn.id}`}
                                            checked={conn.isActive}
                                            onCheckedChange={(checked) => onToggleActive(conn.id, checked)}
                                            aria-label="Ativar conexão"
                                            className="data-[state=checked]:bg-primary"
                                        />
                                        <Label htmlFor={`active-switch-${conn.id}`} className="text-xs sm:text-sm font-medium">
                                            Ativa
                                        </Label>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onSyncWebhook(conn.id)}
                                        disabled={isSyncingWebhook === conn.id}
                                        className="h-8 text-xs sm:text-sm px-2 sm:px-3"
                                    >
                                        {isSyncingWebhook === conn.id ?
                                            <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> :
                                            <Webhook className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                                        }
                                        <span className="hidden sm:inline">Sincronizar</span>
                                        <span className="sm:hidden">Sync</span>
                                        <span className="hidden sm:inline ml-1">Webhook</span>
                                    </Button>
                                </div>
                                <div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto sm:ml-0">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(conn)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Editar
                                            </DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Excluir
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Essa ação não pode ser desfeita. Isso excluirá permanentemente a conexão e removerá seus dados de nossos servidores.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onDelete(conn.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Excluir
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
