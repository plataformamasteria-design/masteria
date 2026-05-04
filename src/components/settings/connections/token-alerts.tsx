
import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { Connection } from './types';

interface TokenAlertsProps {
    connections: Connection[];
}

export function TokenAlerts({ connections }: TokenAlertsProps) {
    const expiringSoonConnections = useMemo(() =>
        connections.filter(c => c.healthStatus === 'expiring_soon'),
        [connections]
    );

    const expiredConnections = useMemo(() =>
        connections.filter(c => c.healthStatus === 'expired'),
        [connections]
    );

    return (
        <>
            {/* Banner de Alerta para Tokens Expirando */}
            {expiringSoonConnections.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50 mb-6">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-yellow-900 mb-1">
                                    Token{expiringSoonConnections.length > 1 ? 's' : ''} Expirando em Breve
                                </h3>
                                <p className="text-sm text-yellow-800 mb-2">
                                    {expiringSoonConnections.length} conexã{expiringSoonConnections.length > 1 ? 'ões têm' : 'o tem'} token{expiringSoonConnections.length > 1 ? 's' : ''} que expira{expiringSoonConnections.length > 1 ? 'm' : ''} em menos de 7 dias.
                                    Renove o{expiringSoonConnections.length > 1 ? 's' : ''} token{expiringSoonConnections.length > 1 ? 's' : ''} para evitar interrupções.
                                </p>
                                <div className="space-y-1">
                                    {expiringSoonConnections.map(conn => (
                                        <div key={conn.id} className="text-xs text-yellow-700 flex items-center gap-2">
                                            <span className="font-medium">{conn.config_name}:</span>
                                            <span>{conn.tokenExpiresIn !== undefined && conn.tokenExpiresIn >= 0
                                                ? `Expira em ${conn.tokenExpiresIn} dia${conn.tokenExpiresIn !== 1 ? 's' : ''}`
                                                : 'Data de expiração não disponível'
                                            }</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Banner de Alerta para Tokens Expirados */}
            {expiredConnections.length > 0 && (
                <Card className="border-red-200 bg-red-50 mb-6">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-900 mb-1">
                                    Token{expiredConnections.length > 1 ? 's' : ''} Expirado{expiredConnections.length > 1 ? 's' : ''}
                                </h3>
                                <p className="text-sm text-red-800 mb-2">
                                    {expiredConnections.length} conexã{expiredConnections.length > 1 ? 'ões têm' : 'o tem'} token{expiredConnections.length > 1 ? 's' : ''} expirado{expiredConnections.length > 1 ? 's' : ''}.
                                    O envio de mensagens está bloqueado pela Meta.
                                </p>
                                <div className="space-y-1 mb-4">
                                    {expiredConnections.map(conn => (
                                        <div key={conn.id} className="text-sm font-medium text-red-900 flex items-center gap-2">
                                            <span>• {conn.config_name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-red-100/50 p-3 rounded-md border border-red-200 text-sm text-red-900 flex flex-col gap-2">
                                    <p className="font-semibold">Como resolver:</p>
                                    <ul className="list-disc pl-5 space-y-1">
                                        <li>
                                            <strong>Solução Rápida (Dura 60 dias):</strong> Clique no botão <b>Importar do Facebook</b> acima para re-autenticar e atualizar o token automaticamente.
                                        </li>
                                        <li>
                                            <strong>Solução Definitiva:</strong> Gere um <i>Token de Usuário de Sistema</i> no painel da Meta Business, em seguida clique nos três pontinhos (<span className="font-serif">...</span>) da conexão na tabela, escolha <b>Editar</b> e cole o novo token permanente.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
    );
}
