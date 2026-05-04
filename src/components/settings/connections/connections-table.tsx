
import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MoreHorizontal,
    Trash2,
    RefreshCw,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle,
    AlertTriangle,
    Phone,
    Instagram
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Connection, ConnectionStatus, WebhookStatus, HealthStatus } from './types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { Power, QrCode, Unplug } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIG HELPER MAPS ---
const connectionStatusConfig: Record<ConnectionStatus, { icon: React.ElementType, color: string, text: string, pulse?: boolean, glow?: string }> = {
    Conectado: { icon: CheckCircle2, color: 'text-emerald-500', text: 'Conectado', pulse: true, glow: 'border-emerald-500/20 bg-emerald-500/10' },
    'Falha na Conexão': { icon: XCircle, color: 'text-destructive', text: 'Falha' },
    'Não Verificado': { icon: Loader2, color: 'text-muted-foreground', text: 'Verificando...' },
};

const webhookStatusConfig: Record<WebhookStatus, { icon: React.ElementType, color: string, text: string }> = {
    CONFIGURADO: { icon: CheckCircle2, color: 'text-green-500', text: 'OK' },
    DIVERGENTE: { icon: AlertCircle, color: 'text-yellow-500', text: 'Divergente' },
    NAO_CONFIGURADO: { icon: XCircle, color: 'text-destructive', text: 'Sem Config' },
    ERRO: { icon: XCircle, color: 'text-destructive', text: 'Erro' },
    VERIFICANDO: { icon: Loader2, color: 'text-muted-foreground', text: '...' },
};

const healthStatusConfig: Record<HealthStatus, { icon: React.ElementType, color: string, text: string, bgColor: string }> = {
    healthy: { icon: CheckCircle2, color: 'text-green-600', text: 'Saudável', bgColor: 'bg-green-50' },
    expiring_soon: { icon: AlertTriangle, color: 'text-yellow-600', text: 'Expira Breve', bgColor: 'bg-yellow-50' },
    expired: { icon: AlertTriangle, color: 'text-red-600', text: 'Expirado', bgColor: 'bg-red-50' },
    error: { icon: XCircle, color: 'text-red-600', text: 'Erro', bgColor: 'bg-red-50' },
    inactive: { icon: AlertCircle, color: 'text-muted-foreground', text: 'Inativa', bgColor: 'bg-muted/50' },
};

interface ConnectionsTableProps {
    connections: Connection[];
    isSyncingWebhook: string | null;
    onToggleActive: (id: string, active: boolean) => void;
    onSyncWebhook: (id: string) => Promise<void>;
    onEdit: (connection: Connection) => void;
    onDelete: (id: string) => Promise<void>;
    onCheckHealth: (connection: Connection) => Promise<void>;
    onRenewToken?: (id: string) => Promise<void>;
    onConnectBaileys?: (id: string, type: string) => void;
    onDisconnectBaileys?: (id: string) => void;
}

export function ConnectionsTable({
    connections,
    isSyncingWebhook,
    onToggleActive,
    onSyncWebhook,
    onEdit,
    onDelete,
    onCheckHealth,
    onRenewToken,
    onConnectBaileys,
    onDisconnectBaileys
}: ConnectionsTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isBulkSyncing, setIsBulkSyncing] = useState(false);
    const [isBulkVerifying, setIsBulkVerifying] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const toggleSelectAll = () => {
        if (selectedIds.size === connections.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(connections.map(c => c.id)));
        }
    };

    const toggleSelectOne = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleBulkDelete = async () => {
        setIsBulkDeleting(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id => onDelete(id)));
            setSelectedIds(new Set());
        } finally {
            setIsBulkDeleting(false);
            setShowDeleteDialog(false);
        }
    };

    const handleBulkSyncWebhook = async () => {
        const validIds = Array.from(selectedIds).filter(id => {
            const conn = connections.find(c => c.id === id);
            return conn?.connectionType === 'meta_api';
        });
        if (validIds.length === 0) return;
        setIsBulkSyncing(true);
        try {
            await Promise.all(validIds.map(id => onSyncWebhook(id)));
        } finally {
            setIsBulkSyncing(false);
        }
    };

    const handleBulkVerifyToken = async () => {
        const validConns = connections.filter(c => selectedIds.has(c.id) && c.connectionType === 'meta_api');
        if (validConns.length === 0) return;
        setIsBulkVerifying(true);
        try {
            await Promise.all(validConns.map(c => onCheckHealth(c)));
        } finally {
            setIsBulkVerifying(false);
        }
    };

    return (
        <div className="space-y-4 relative">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox
                                    checked={connections.length > 0 && selectedIds.size === connections.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="w-[250px]">Nome & WABA</TableHead>
                            <TableHead>Identificação</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="w-[120px]">Webhook</TableHead>
                            <TableHead className="w-[100px]">Saúde</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {connections.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">Nenhuma conexão encontrada.</TableCell>
                            </TableRow>
                        ) : (
                            connections.map((conn) => {
                                let statusInfo = connectionStatusConfig[conn.connectionStatus] || connectionStatusConfig['Não Verificado'];
                                let webInfo = webhookStatusConfig[conn.webhookStatus] || webhookStatusConfig['VERIFICANDO'];
                                const healthInfo = conn.healthStatus ? (healthStatusConfig[conn.healthStatus] || healthStatusConfig['error']) : null;

                                if (conn.connectionType === 'baileys' && conn.healthStatus === 'healthy') {
                                    statusInfo = connectionStatusConfig['Conectado'];
                                    webInfo = webhookStatusConfig['CONFIGURADO'];
                                }

                                const Icon = conn.connectionType?.includes('instagram') ? Instagram : Phone;
                                const idLabel = conn.connectionType?.includes('instagram') ? 'User ID' : 'Phone ID';

                                return (
                                    <TableRow key={conn.id} className="group hover:bg-muted/40 transition-colors cursor-default" data-state={selectedIds.has(conn.id) && "selected"}>
                                        <TableCell>
                                            <Checkbox checked={selectedIds.has(conn.id)} onCheckedChange={() => toggleSelectOne(conn.id)} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium flex items-center gap-2">
                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {conn.config_name}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">WABA: {conn.wabaId || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 text-xs">
                                                <div className="flex flex-col mt-0.5">
                                                    <span className="text-muted-foreground">{idLabel}</span>
                                                    <span className="font-mono">{conn.phoneNumberId || '-'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn("flex items-center text-xs font-medium", statusInfo.color)}>
                                                {React.createElement(statusInfo.icon, { className: "mr-1 h-3 w-3" })}
                                                {statusInfo.text}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn("flex items-center text-xs font-medium", webInfo.color)}>
                                                {isSyncingWebhook === conn.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : React.createElement(webInfo.icon, { className: "mr-1 h-3 w-3" })}
                                                {webInfo.text}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {healthInfo ? (
                                                    <>
                                                        <Badge variant="outline" className={cn("w-fit font-normal gap-1", healthInfo.bgColor, healthInfo.color)}>
                                                            {React.createElement(healthInfo.icon, { className: "h-3 w-3" })}
                                                            {healthInfo.text}
                                                        </Badge>
                                                        <span className={cn(
                                                            "text-[10px] font-medium ml-1",
                                                            conn.tokenExpiresIn <= 7 ? "text-red-600" : "text-yellow-600"
                                                        )}>
                                                            Expira em {conn.tokenExpiresIn} dias
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(conn.id)}>
                                                        Copiar ID Interno
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />

                                                    {/* Meta API Specific Actions */}
                                                    {conn.connectionType === 'meta_api' && (
                                                        <>
                                                            <DropdownMenuItem onClick={() => onCheckHealth(conn)}>
                                                                <ShieldCheck className="mr-2 h-4 w-4" /> Validar Token
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => onSyncWebhook(conn.id)}>
                                                                <RefreshCw className="mr-2 h-4 w-4" /> Sync Webhook
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}

                                                    <DropdownMenuItem onClick={() => onEdit(conn)}>
                                                        Editar
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator />

                                                    {/* Toggle Active Status */}
                                                    <DropdownMenuItem onClick={() => onToggleActive(conn.id, !conn.isActive)}>
                                                        {conn.isActive ? (
                                                            <><Unplug className="mr-2 h-4 w-4" /> Desativar</>
                                                        ) : (
                                                            <><Power className="mr-2 h-4 w-4 text-green-600" /> Ativar</>
                                                        )}
                                                    </DropdownMenuItem>

                                                    {onRenewToken && conn.tokenExpiresIn !== undefined && (
                                                        <DropdownMenuItem onClick={() => onRenewToken(conn.id)}>
                                                            <RefreshCw className="mr-2 h-4 w-4" />
                                                            <span>Renovar Token</span>
                                                        </DropdownMenuItem>
                                                    )}

                                                    {/* WhatsMeow Actions */}
                                                    {conn.connectionType === 'baileys' && onConnectBaileys && onDisconnectBaileys && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            {/* ALWAYS Show Connect/New Session options to allow forced reconnection */}
                                                            <DropdownMenuItem onClick={() => onConnectBaileys(conn.id, 'resume')}>
                                                                <Power className="mr-2 h-4 w-4 text-green-600" />
                                                                <span>Conectar / Resume</span>
                                                            </DropdownMenuItem>

                                                            <DropdownMenuItem asChild>
                                                                <Link href="/whatsapp-sessoes" className="w-full cursor-pointer flex items-center">
                                                                    <QrCode className="mr-2 h-4 w-4" />
                                                                    <span>Nova Sessão</span>
                                                                </Link>
                                                            </DropdownMenuItem>

                                                            {/* Only show Disconnect if technically connected or healthy */}
                                                            {!(conn.baileysStatus === 'disconnected' || conn.baileysStatus === 'failed') && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem onClick={() => onDisconnectBaileys(conn.id)}>
                                                                        <Unplug className="mr-2 h-4 w-4 text-orange-600" />
                                                                        <span>Desconectar</span>
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </>
                                                    )}

                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => {
                                                            setSelectedIds(new Set([conn.id])); // Select explicitly for safety
                                                            setShowDeleteDialog(true);
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        <span>Excluir</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* CONFIRM BULK DELETE DIALOG */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {selectedIds.size} conexões?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. As conexões selecionadas serão removidas permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive hover:bg-destructive/90">
                            {isBulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Exclusão"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
