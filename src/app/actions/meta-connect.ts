'use server';

import { getCompanyIdFromSession } from "@/app/actions";

import { headers } from "next/headers";

export async function getMetaAuthUrl(returnTo?: string) {
    try {
        const clientId = process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID || '1351722093634418';

        // Detect current domain dynamically from request headers
        const headersList = await headers();
        const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'masteria.app';
        const proto = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
        const baseUrl = `${proto}://${host}`;

        // Custom callback exclusively for Meta Universal Auth
        const redirectUri = `${baseUrl}/api/auth/meta-callback`;

        if (!clientId) {
            throw new Error("FACEBOOK_CLIENT_ID não está configurado");
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
            'pages_manage_metadata'
        ].join(',');

        const companyId = await getCompanyIdFromSession();
        if (!companyId) {
            throw new Error("Não foi possível identificar a sessão da empresa.");
        }

        const state = Buffer.from(JSON.stringify({ companyId, returnTo, baseUrl })).toString('base64');

        // Main Meta OAuth Login URL
        const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}&config_id=&extras=`;

        return { success: true, url };
    } catch (error: any) {
        console.error("GetMetaAuthUrl Error:", error);
        return { success: false, error: error.message };
    }
}
