// src/app/api/v1/integrations/kommo/pipelines/route.ts
// Proxies Kommo API to list available pipelines and their stages

import { NextResponse, type NextRequest } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

/**
 * Extract the api_domain from a JWT token payload (without verification).
 */
function getApiDomainFromToken(token: string): string | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3 || !parts[1]) return null;
        const base64Str = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64Str, 'base64').toString('utf-8'));
        return payload.api_domain || null;
    } catch {
        return null;
    }
}

export async function GET(_request: NextRequest) {
    try {
        const companyId = await getCompanyIdFromSession();

        // 1. Get integration + credentials
        const [integration] = await db
            .select()
            .from(crmIntegrations)
            .where(
                and(
                    eq(crmIntegrations.companyId, companyId),
                    eq(crmIntegrations.provider, 'kommo')
                )
            )
            .limit(1);

        if (!integration || integration.status !== 'connected') {
            return NextResponse.json({ error: 'Integração Kommo não conectada.' }, { status: 404 });
        }

        const [account] = await db
            .select()
            .from(crmAccounts)
            .where(eq(crmAccounts.integrationId, integration.id))
            .limit(1);

        if (!account) {
            return NextResponse.json({ error: 'Credenciais Kommo não encontradas.' }, { status: 404 });
        }

        const accessToken = decrypt(account.accessToken);
        if (!accessToken) {
            return NextResponse.json({ error: 'Falha ao descriptografar token.' }, { status: 500 });
        }

        // 2. Build URL — try subdomain first, then JWT api_domain
        let baseUrl = account.domain;
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        baseUrl = baseUrl.replace(/\/$/, '');

        const apiDomain = getApiDomainFromToken(accessToken);
        const urlsToTry = [
            `${baseUrl}/api/v4/leads/pipelines`,
        ];
        if (apiDomain) {
            urlsToTry.push(`https://${apiDomain}/api/v4/leads/pipelines`);
        }

        let pipelinesData: any = null;

        for (const url of urlsToTry) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.status === 401 && urlsToTry.indexOf(url) < urlsToTry.length - 1) {
                    continue;
                }

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    throw new Error(`Kommo API ${response.status}: ${errorText}`);
                }

                pipelinesData = await response.json();
                break;
            } catch (error) {
                if (urlsToTry.indexOf(url) < urlsToTry.length - 1) continue;
                throw error;
            }
        }

        if (!pipelinesData) {
            return NextResponse.json({ error: 'Falha ao consultar pipelines do Kommo.' }, { status: 502 });
        }

        // 3. Transform response for frontend
        const pipelines = (pipelinesData._embedded?.pipelines || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            is_main: p.is_main || false,
            statuses: (p._embedded?.statuses || []).map((s: any) => ({
                id: s.id,
                name: s.name,
                sort: s.sort,
                color: s.color,
                type: s.type, // 0=normal, 1=won, 2=lost
            })).filter((s: any) => s.type === 0), // Only show active stages, not won/lost
        }));

        return NextResponse.json({ pipelines });

    } catch (error) {
        console.error('[Kommo Pipelines] Error:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
