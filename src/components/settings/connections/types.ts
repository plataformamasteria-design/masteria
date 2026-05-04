import type { Connection as BaseConnection } from '@/lib/types';

export type ConnectionStatus = 'Conectado' | 'Falha na Conexão' | 'Não Verificado';
export type WebhookStatus = 'CONFIGURADO' | 'DIVERGENTE' | 'NAO_CONFIGURADO' | 'VERIFICANDO' | 'ERRO';
export type HealthStatus = 'healthy' | 'expiring_soon' | 'expired' | 'error' | 'inactive';
export type HmacHealthStatus = 'healthy' | 'warning' | 'error' | 'no_data' | 'loading';

export type Connection = BaseConnection & {
    connectionStatus?: ConnectionStatus;
    webhookStatus?: WebhookStatus;
    healthStatus?: HealthStatus;
    healthErrorMessage?: string;
    lastHealthCheck?: Date;
    tokenExpiresIn?: number;
    hmacHealth?: {
        status: HmacHealthStatus;
        successRate: number | null;
        lastValidatedAt: string | null;
        lastError: string | null;
    };
    baileysStatus?: string;
};
