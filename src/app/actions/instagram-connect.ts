'use server';

import { getCompanyIdFromSession } from "@/app/actions";

export async function getInstagramAuthUrl() {
    try {
        // Falls back to known ID from dashboard if env vars are missing
        const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID || '1351722093634418';

        // Detect current domain from host header or env
        const host = typeof window !== 'undefined' 
            ? window.location.origin 
            : process.env.NEXT_PUBLIC_APP_URL || 'https://masteria-temporario.up.railway.app';
            
        const baseUrl = host.endsWith('/') ? host.slice(0, -1) : host;
        const redirectUri = `${baseUrl}/api/instagram-callback`;

        console.log(`[InstagramAuth] Generating URL with redirect_uri: ${redirectUri}`);

        if (!clientId) {
            throw new Error("Client ID not configured");
        }

        // Scopes for Business Messaging (Updated from User Dashboard)
        const scopes = [
            'instagram_business_basic',
            'instagram_business_manage_messages',
            'instagram_business_manage_comments',
            'instagram_business_content_publish',
            'instagram_business_manage_insights'
        ].join(',');

        // State can be used to pass companyId securely or verify CSRF
        const companyId = await getCompanyIdFromSession();
        const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');

        // Using www.instagram.com for Business Login (as per Dashboard)
        const url = `https://www.instagram.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}&force_reauth=true`;

        return { success: true, url };
    } catch (error: any) {
        console.error("GetIGAuthUrl Error:", error);
        return { success: false, error: error.message };
    }
}
