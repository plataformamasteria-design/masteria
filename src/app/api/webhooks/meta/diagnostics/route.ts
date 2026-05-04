// src/app/api/webhooks/meta/diagnostics/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { companies, connections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const companySlug = searchParams.get('slug');

        if (!companySlug) {
            return NextResponse.json({ 
                error: 'Missing company slug parameter',
                usage: '/api/webhooks/meta/diagnostics?slug=YOUR_WEBHOOK_SLUG'
            }, { status: 400 });
        }

        const requestHost = request.headers.get('host');
        const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim();
        const queryDomain = searchParams.get('domain');
        
        const domain = queryDomain || requestHost || replitDomain || 'localhost:5000';

        const [company] = await db
            .select({ 
                id: companies.id, 
                name: companies.name,
                webhookSlug: companies.webhookSlug
            })
            .from(companies)
            .where(eq(companies.webhookSlug, companySlug))
            .limit(1);

        if (!company) {
            return NextResponse.json({
                status: 'error',
                message: 'Company não encontrada com este webhook slug',
                slug: companySlug,
                suggestion: 'Verifique se o slug está correto no banco de dados'
            }, { status: 404 });
        }

        const metaConnections = await db
            .select()
            .from(connections)
            .where(and(
                eq(connections.companyId, company.id),
                eq(connections.connectionType, 'meta_api')
            ));

        const activeConnection = metaConnections.find(conn => conn.isActive);
        const inactiveConnections = metaConnections.filter(conn => !conn.isActive);

        const webhookUrl = `https://${domain}/api/webhooks/meta/${company.webhookSlug}`;
        const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=TEST`;

        return NextResponse.json({
            status: 'success',
            timestamp: new Date().toISOString(),
            company: {
                id: company.id,
                name: company.name,
                webhookSlug: company.webhookSlug
            },
            webhook: {
                url: webhookUrl,
                testUrl: testUrl,
                domain: domain
            },
            connections: {
                total: metaConnections.length,
                active: activeConnection ? {
                    configName: activeConnection.config_name,
                    phoneNumberId: activeConnection.phoneNumberId,
                    wabaId: activeConnection.wabaId,
                    lastConnected: activeConnection.lastConnected
                } : null,
                inactive: inactiveConnections.map(conn => ({
                    configName: conn.config_name,
                    phoneNumberId: conn.phoneNumberId,
                    isActive: conn.isActive
                }))
            },
            instructions: {
                step1: 'Copie a URL do webhook acima',
                step2: 'Acesse Meta Business Manager',
                step3: 'Configure o webhook com a URL fornecida',
                step4: `Associe ao Phone Number ID: ${activeConnection?.phoneNumberId || 'NENHUM ATIVO'}`,
                step5: 'Subscreva aos eventos: messages, message_status',
                step6: 'Teste enviando uma mensagem WhatsApp',
                warning: inactiveConnections.length > 0 ? 
                    `⚠️ ${inactiveConnections.length} conexão(ões) inativa(s) detectada(s). Certifique-se de que o webhook aponta para a conexão ATIVA!` : 
                    '✅ Nenhuma conexão inativa detectada'
            },
            healthCheck: {
                hasActiveConnection: !!activeConnection,
                hasMultipleConnections: metaConnections.length > 1,
                needsAttention: !activeConnection || inactiveConnections.length > 0
            }
        }, { status: 200 });

    } catch (error) {
        console.error('[Webhook Diagnostics] Erro:', error);
        return NextResponse.json({ 
            status: 'error',
            message: 'Erro ao realizar diagnóstico',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
