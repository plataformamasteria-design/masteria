
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { encrypt } from '@/lib/crypto';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(new URL(`/connections?error=${encodeURIComponent(error)}`, req.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/connections?error=no_code', req.url));
    }

    try {
        // Decode state to get CompanyID
        let companyId = '';
        try {
            const decodedState = JSON.parse(Buffer.from(state || '', 'base64').toString('utf-8'));
            companyId = decodedState.companyId;
        } catch (e) {
            console.error("Invalid State:", e);
        }

        if (!companyId) {
            return NextResponse.redirect(new URL('/connections?error=invalid_state', req.url));
        }

        const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.FACEBOOK_CLIENT_ID || '1351722093634418';
        const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET!;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUri = `${baseUrl}/api/instagram-callback`;
    
    console.log(`[InstagramCallback] Processing code exchange. Redirect URI: ${redirectUri}`);

        // 1. Exchange Code for Short-Lived Token
        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code: code
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error("Token Exchange Failed:", tokenData);
            throw new Error("Failed to exchange token");
        }

        let accessToken = tokenData.access_token;
        const userId = tokenData.user_id; // Instagram User ID

        // 2. Exchange for Long-Lived Token (Optional but recommended)
        const longTokenRes = await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${accessToken}`);
        const longTokenData = await longTokenRes.json();

        if (longTokenData.access_token) {
            accessToken = longTokenData.access_token;
        }

        // 3. Get User Profile (Username)
        const profileRes = await fetch(`https://graph.instagram.com/v24.0/me?fields=id,username,account_type&access_token=${accessToken}`);
        const profile = await profileRes.json();

        const username = profile.username || `IG-${userId}`;

        // 4. Save to Database
        const encryptedToken = encrypt(accessToken);

        // Check existing
        const [existing] = await db.select().from(connections)
            .where(and(
                eq(connections.phoneNumberId, String(userId)), // Storing IG User ID in phoneNumberId
                eq(connections.connectionType, 'instagram_direct'),
                eq(connections.companyId, companyId)
            ));

        if (existing) {
            await db.update(connections).set({
                accessToken: encryptedToken,
                lastConnected: new Date(),
                isActive: true, // Reactivate
                config_name: `Instagram (Direct) - ${username}`
            }).where(eq(connections.id, existing.id));
        } else {
            await db.insert(connections).values({
                companyId,
                config_name: `Instagram (Direct) - ${username}`,
                connectionType: 'instagram_direct',
                wabaId: 'instagram-direct', // Placeholder
                phoneNumberId: String(userId),
                appId: clientId,
                accessToken: encryptedToken,
                webhookSecret: 'auto_generated',
                appSecret: encrypt(clientSecret),
                isActive: true,
                environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
                phone: username // Display purpose
            });
        }

        return NextResponse.redirect(new URL('/connections?success=instagram_connected', req.url));

    } catch (error: any) {
        console.error("IG Callback Error:", error);
        return NextResponse.redirect(new URL(`/connections?error=${encodeURIComponent(error.message)}`, req.url));
    }
}
