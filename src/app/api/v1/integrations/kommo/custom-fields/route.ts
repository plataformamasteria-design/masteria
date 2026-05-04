import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { decrypt } from '@/lib/crypto';
import { getApiDomainFromToken } from '@/services/kommo-lead-sync.service';

/**
 * Proxy to fetch available Custom Fields for Leads from Kommo API.
 * GET /api/v1/integrations/kommo/custom-fields
 */
export async function GET(request: Request) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get Integration
        const [integration] = await db
            .select()
            .from(crmIntegrations)
            .where(eq(crmIntegrations.companyId, companyId))
            .limit(1);

        if (!integration || integration.status !== 'connected') {
            return NextResponse.json({ error: 'Kommo integration not found or disconnected' }, { status: 404 });
        }

        // 2. Get Credentials
        const [account] = await db
            .select()
            .from(crmAccounts)
            .where(eq(crmAccounts.integrationId, integration.id))
            .limit(1);

        if (!account) {
            return NextResponse.json({ error: 'Credentials not found' }, { status: 404 });
        }

        const token = decrypt(account.accessToken);
        const baseUrl = account.domain.replace(/\/$/, '');
        const apiDomain = getApiDomainFromToken(token);

        // 3. Try primary URL, fallback to apiDomain
        const urlsToTry = [
            `${baseUrl}/api/v4/leads/custom_fields`,
        ];
        if (apiDomain) {
            urlsToTry.push(`https://${apiDomain}/api/v4/leads/custom_fields`);
        }

        let fieldsData = null;
        let lastError = null;

        for (const url of urlsToTry) {
            try {
                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const rawFields = data._embedded?.custom_fields || [];

                    // Transform to a cleaner shape for the frontend
                    fieldsData = rawFields.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        type: f.type,
                        // Optionally extract enums if it's a select field
                        enums: Array.isArray(f.enums) ? f.enums.map((e: any) => ({ id: e.id, value: e.value })) : undefined
                    }));
                    break;
                } else if (response.status === 401) {
                    lastError = new Error('Unauthorized response from Kommo API (token expired or invalid)');
                    // Keep trying other URLs just in case, but usually 401 is fatal
                } else {
                    const text = await response.text();
                    lastError = new Error(`Kommo API error: ${response.status} - ${text}`);
                }
            } catch (error) {
                lastError = error;
            }
        }

        if (fieldsData) {
            return NextResponse.json(fieldsData);
        } else {
            console.error('[Kommo Custom Fields]', lastError);
            return NextResponse.json(
                { error: 'Failed to fetch custom fields from Kommo', details: lastError instanceof Error ? lastError.message : String(lastError) },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('[Kommo Custom Fields GET Error]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
