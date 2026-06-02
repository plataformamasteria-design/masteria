'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Smartphone,
  Instagram,
  RefreshCw,
  QrCode,
  ArchiveRestore,
  MoreHorizontal,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Power,
  Unplug,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type UnifiedPlatform = 'meta_api' | 'instagram' | 'evolution';
export type UnifiedStatus = 'connected' | 'disconnected' | 'qr' | 'error' | 'verifying';

export interface UnifiedConnectionItem {
  id: string;
  name: string;
  platform: UnifiedPlatform;
  status: UnifiedStatus;
  
  // Details
  identifier?: string;
  wabaId?: string;
  
  // Dates
  createdAt: Date;
  lastConnected?: Date;
  
  // Meta specific
  webhookStatus?: string;
  healthStatus?: string;
  tokenExpiresInDays?: number;
  isActive?: boolean;
  
  // Baileys specific
  hasAuth?: boolean;
  
  // Raw objects
  rawConnection?: any;
  rawBaileys?: any;
}

interface UnifiedConnectionCardProps {
  item: UnifiedConnectionItem;
  
  // Meta Actions
  onCheckHealth?: (connection: any) => Promise<void>;
  onSyncWebhook?: (id: string) => Promise<void>;
  onEditMeta?: (connection: any) => void;
  onToggleActive?: (id: string, active: boolean) => void;
  onRenewToken?: (id: string) => Promise<void>;
  
  // Baileys Actions
  onConnectBaileys?: (id: string, name: string) => void;
  onReconnectBaileys?: (id: string, name: string) => void;
  onResumeBaileys?: (id: string) => void;
  onDisconnectBaileys?: (id: string) => void;
  
  // Global Actions
  onDelete: (id: string, platform: UnifiedPlatform) => void;
}

export function UnifiedConnectionCard({
  item,
  onCheckHealth,
  onSyncWebhook,
  onEditMeta,
  onToggleActive,
  onRenewToken,
  onConnectBaileys,
  onReconnectBaileys,
  onResumeBaileys,
  onDisconnectBaileys,
  onDelete
}: UnifiedConnectionCardProps) {
  // Configurações visuais baseadas na plataforma
  const platformConfig = {
    meta_api: {
      icon: Smartphone,
      label: 'WhatsApp Cloud',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20'
    },
    instagram: {
      icon: Instagram,
      label: 'Instagram Direct',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20'
    },
    evolution: {
      icon: QrCode,
      label: 'WhatsApp Normal',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20'
    }
  };

  const currentPlatform = platformConfig[item.platform] || platformConfig.evolution;
  const PlatformIcon = currentPlatform.icon;

  // Configurações de status principal
  const getStatusDisplay = () => {
    switch (item.status) {
      case 'connected':
        return { icon: CheckCircle2, text: 'Conectado', classes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'verifying':
        return { icon: Loader2, text: 'Verificando...', classes: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20 animate-pulse' };
      case 'qr':
        return { icon: QrCode, text: 'Aguardando QR', classes: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'error':
      case 'disconnected':
      default:
        return { icon: XCircle, text: 'Desconectado / Falha', classes: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  // Webhook Display (Apenas Meta)
  const getWebhookDisplay = () => {
    if (!item.webhookStatus) return null;
    switch (item.webhookStatus) {
      case 'CONFIGURADO': return { icon: CheckCircle2, text: 'Webhook OK', color: 'text-emerald-500' };
      case 'DIVERGENTE': return { icon: AlertCircle, text: 'Webhook Div.', color: 'text-amber-500' };
      case 'VERIFICANDO': return { icon: Loader2, text: 'Verificando...', color: 'text-zinc-400' };
      default: return { icon: XCircle, text: 'Sem Webhook', color: 'text-rose-500' };
    }
  };
  const webDisplay = getWebhookDisplay();

  return (
    <div className="group relative border border-zinc-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_30px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] bg-white dark:bg-white/[0.02] backdrop-blur-md rounded-[2rem] overflow-hidden p-6 transition-all hover:bg-zinc-50 dark:hover:bg-white/[0.04]">
      {/* Top Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className={cn("w-fit font-normal text-[10px] mb-1 gap-1", currentPlatform.bg, currentPlatform.color)}>
            <PlatformIcon className="w-3 h-3" />
            {currentPlatform.label}
          </Badge>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            {item.name}
          </h3>
        </div>
        
        {/* Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-50 group-hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-white/10">
              <MoreHorizontal className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10">
            <DropdownMenuLabel className="text-xs text-zinc-500">Ações</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.id)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
              <Copy className="mr-2 h-4 w-4" /> Copiar ID Interno
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5" />

            {item.platform === 'meta_api' && (
              <>
                <DropdownMenuItem onClick={() => onCheckHealth && onCheckHealth(item.rawConnection)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-400" /> Validar Token
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSyncWebhook && onSyncWebhook(item.id)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                  <RefreshCw className="mr-2 h-4 w-4 text-blue-400" /> Sincronizar Webhook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEditMeta && onEditMeta(item.rawConnection)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                  Editar Integração
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5" />
                <DropdownMenuItem onClick={() => onToggleActive && onToggleActive(item.id, !item.isActive)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                  {item.isActive ? (
                      <><Unplug className="mr-2 h-4 w-4" /> Desativar</>
                  ) : (
                      <><Power className="mr-2 h-4 w-4 text-emerald-400" /> Ativar</>
                  )}
                </DropdownMenuItem>
                {onRenewToken && item.tokenExpiresInDays !== undefined && (
                  <DropdownMenuItem onClick={() => onRenewToken(item.id)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                      <RefreshCw className="mr-2 h-4 w-4" /> Renovar Token
                  </DropdownMenuItem>
                )}
              </>
            )}

            {item.platform === 'evolution' && (
              <>
                 <DropdownMenuItem onClick={() => onReconnectBaileys && onReconnectBaileys(item.id, item.name)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                    <Power className="mr-2 h-4 w-4 text-emerald-400" /> Conectar / Atualizar
                </DropdownMenuItem>
                {item.status !== 'disconnected' && item.status !== 'error' && (
                  <DropdownMenuItem onClick={() => onDisconnectBaileys && onDisconnectBaileys(item.id)} className="hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer">
                    <Unplug className="mr-2 h-4 w-4 text-amber-500" /> Desconectar Sessão
                  </DropdownMenuItem>
                )}
              </>
            )}
            
            <DropdownMenuSeparator className="bg-zinc-100 dark:bg-white/5" />
            <DropdownMenuItem 
              onClick={() => onDelete(item.id, item.platform)} 
              className="text-rose-500 focus:text-rose-400 focus:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Identifiers & Details */}
      <div className="flex flex-col gap-1.5 mb-6">
        {item.identifier && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>{item.platform === 'instagram' ? 'User ID:' : 'Fone ID / Número:'}</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.identifier}</span>
          </div>
        )}
        {item.wabaId && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>WABA ID:</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300">{item.wabaId}</span>
          </div>
        )}
        
        {item.platform === 'evolution' && item.lastConnected && (
          <div className="text-xs text-zinc-500 mt-2">
            Última conexão: {format(new Date(item.lastConnected), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        )}

        {/* Health Tags */}
        {(item.healthStatus || item.webhookStatus) && (
          <div className="flex flex-wrap gap-2 mt-2">
            {item.tokenExpiresInDays !== undefined && (
              <Badge variant="outline" className={cn("text-[10px] font-normal border-zinc-200 dark:border-white/10", item.tokenExpiresInDays <= 7 ? "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/10" : "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/10")}>
                Token {item.tokenExpiresInDays}d
              </Badge>
            )}
            {webDisplay && (
              <Badge variant="outline" className="text-[10px] font-normal border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300">
                {React.createElement(webDisplay.icon, { className: cn("w-3 h-3 mr-1", webDisplay.color) })}
                <span className={webDisplay.color}>{webDisplay.text}</span>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Main Status & Quick Action Buttons */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-200 dark:border-white/5">
        <div className={cn("flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border", statusDisplay.classes)}>
          {React.createElement(StatusIcon, { className: "w-3.5 h-3.5 mr-1.5" })}
          {statusDisplay.text}
        </div>
        
        <div className="flex gap-2">
          {item.platform === 'evolution' && item.status !== 'connected' && (
             <Button
             size="sm"
             className="h-7 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-all"
             onClick={() => onConnectBaileys && onConnectBaileys(item.id, item.name)}
           >
             <QrCode className="h-3 w-3 mr-1.5" />
             Conectar
           </Button>
          )}

          {item.platform === 'evolution' && item.status !== 'connected' && item.hasAuth && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-bold"
              onClick={() => onResumeBaileys && onResumeBaileys(item.id)}
            >
              <ArchiveRestore className="h-3 w-3 mr-1.5" />
              Recuperar
            </Button>
          )}

          {item.platform === 'meta_api' && item.status === 'error' && (
             <Button
             size="sm"
             variant="outline"
             className="h-7 text-xs rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 font-bold"
             onClick={() => onCheckHealth && onCheckHealth(item.rawConnection)}
           >
             <RefreshCw className="h-3 w-3 mr-1.5" />
             Testar Token
           </Button>
          )}
        </div>
      </div>
    </div>
  );
}
