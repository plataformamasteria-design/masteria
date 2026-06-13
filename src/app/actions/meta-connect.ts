'use server';

import { getCompanyIdFromSession } from "@/app/actions";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { marketingCredentials } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getMetaAppConfigAction() {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) return { success: false };

        const [cred] = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'))
        ).limit(1);

        if (cred && cred.credentials) {
            const c = cred.credentials as any;
            return { success: true, appId: c.app_id || '', appSecret: c.app_secret || '' };
        }
        return { success: true, appId: '', appSecret: '' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function saveMetaAppConfigAction(appId: string, appSecret: string) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) throw new Error("Não foi possível identificar a sessão da empresa.");

        const [cred] = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'))
        ).limit(1);

        if (cred) {
            const current = (cred.credentials as any) || {};
            await db.update(marketingCredentials).set({
                credentials: { ...current, app_id: appId, app_secret: appSecret },
                updatedAt: new Date()
            }).where(eq(marketingCredentials.id, cred.id));
        } else {
            await db.insert(marketingCredentials).values({
                companyId,
                platform: 'meta',
                status: 'disconnected', // Initially disconnected until they login
                credentials: { app_id: appId, app_secret: appSecret }
            });
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getMetaAuthUrl(returnTo?: string) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            throw new Error("Não foi possível identificar a sessão da empresa.");
        }

        let clientId = process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID || '1351722093634418';

        // Check if user has custom app_id
        const [cred] = await db.select().from(marketingCredentials).where(
            and(eq(marketingCredentials.companyId, companyId), eq(marketingCredentials.platform, 'meta'))
        ).limit(1);

        if (cred && cred.credentials) {
            const c = cred.credentials as any;
            if (c.app_id) {
                clientId = c.app_id;
            }
        }

        // Detect current domain dynamically from request headers
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'masteria-temporario.up.railway.app';
        const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${proto}://${host}`;

        // Custom callback exclusively for Meta Universal Auth
        const redirectUri = `${baseUrl}/api/auth/meta-callback`;

        if (!clientId) {
            throw new Error("FACEBOOK_CLIENT_ID não está configurado e nenhum App customizado foi informado.");
        }

        // Expanded permissions to cover both WhatsApp Business API and Meta Ads/Marketing reads
        const scopes = [
            'whatsapp_business_management',
            'whatsapp_business_messaging',
            'business_management',
            'ads_management',
            'ads_read',
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_metadata',
            'leads_retrieval',           // Acesso a leadgen_forms e lead_gen_form_id
            'pages_manage_ads',          // Gerenciar anúncios em páginas
        ].join(',');

        const state = Buffer.from(JSON.stringify({ companyId, returnTo, baseUrl })).toString('base64');

        // Main Meta OAuth Login URL
        const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}&config_id=&extras=`;

        return { success: true, url };
    } catch (error: any) {
        console.error("GetMetaAuthUrl Error:", error);
        return { success: false, error: error.message };
    }
}
