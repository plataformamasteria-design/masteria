import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuthWithUserOr401 } from '@/lib/api-auth-helper';
import { evolutionApiService } from '@/services/evolution-api.service';
import { decrypt } from '@/lib/crypto';
import { apiCache } from '@/lib/api-cache';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v21.0';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuthWithUserOr401();
        if (authResult instanceof NextResponse) return authResult;
        const { companyId } = authResult;

        const allConnections = await db.select().from(connections).where(eq(connections.companyId, companyId));

        // Sync Evolution / Baileys profiles
        try {
            const instancesData = await evolutionApiService.fetchAllInstances();
            for (const conn of allConnections) {
                if (conn.connectionType === 'evolution' || conn.connectionType === 'baileys') {
                    const instance = instancesData.find((inst: any) => inst.name === conn.id || inst.instanceName === conn.id);
                    if (instance) {
                        const newName = instance.profileName || null;
                        const newPic = instance.profilePicUrl || null;
                        if (newName !== conn.profileName || newPic !== conn.profilePicUrl) {
                            await db.update(connections)
                                .set({ profileName: newName, profilePicUrl: newPic })
                                .where(eq(connections.id, conn.id));
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Sync Profiles] Erro ao sincronizar Evolution:', e);
        }

        // Sync Meta profiles
        for (const conn of allConnections) {
            if ((conn.connectionType === 'meta_api' || conn.connectionType === 'instagram') && conn.phoneNumberId && conn.accessToken) {
                try {
                    const userToken = decrypt(conn.accessToken);
                    let picUrl: string | undefined = undefined;
                    let profileName: string | undefined = undefined;

                    if (conn.connectionType === 'meta_api') {
                        const profileUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`;
                        const profileRes = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${userToken}` } });
                        const profileData = await profileRes.json();
                        picUrl = profileData?.data?.[0]?.profile_picture_url;
                    } else {
                        const profileUrl = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${conn.phoneNumberId}?fields=profile_picture_url,name,username`;
                        const profileRes = await fetch(profileUrl, { headers: { 'Authorization': `Bearer ${userToken}` } });
                        const profileData = await profileRes.json();
                        picUrl = profileData?.profile_picture_url;
                        profileName = profileData?.name || profileData?.username;
                    }

                    if (picUrl || profileName) {
                        await db.update(connections)
                            .set({ 
                                profilePicUrl: picUrl || conn.profilePicUrl, 
                                profileName: profileName || conn.profileName 
                            })
                            .where(eq(connections.id, conn.id));
                    }
                } catch (e) {
                    console.warn('[Sync Profiles] Erro ao sincronizar Meta:', e);
                }
            }
        }

        apiCache.invalidatePattern(`connections:${companyId}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro ao sincronizar perfis:', error);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
