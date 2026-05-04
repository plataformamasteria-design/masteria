'use server';

import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v20.0';

export type FacebookPermissionStatus = 'granted' | 'declined' | 'expired' | 'missing';

export interface FacebookPermission {
    permission: string;
    status: FacebookPermissionStatus;
}

async function getFacebookAccessToken() {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return null;

    const [user] = await db
        .select({ facebookAccessToken: users.facebookAccessToken })
        .from(users)
        .where(eq(users.id, session.user.id));

    return user?.facebookAccessToken || null;
}

export async function getUserFacebookPermissions(): Promise<{ success: boolean; permissions: FacebookPermission[]; error?: string }> {
    try {
        const accessToken = await getFacebookAccessToken();
        if (!accessToken) {
            return { success: false, permissions: [], error: 'Não conectado ao Facebook.' };
        }

        const response = await fetch(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/permissions?access_token=${accessToken}`);

        if (!response.ok) {
            const errorData = await response.json();
            // Handle expired/invalid token gracefully
            if (errorData.error?.code === 190) {
                return { success: false, permissions: [], error: 'Token de acesso expirado. Por favor, faça login novamente.' };
            }
            throw new Error(errorData.error?.message || 'Falha ao buscar permissões.');
        }

        const data = await response.json();

        // Data format: { data: [ { permission: 'email', status: 'granted' }, ... ] }
        return { success: true, permissions: data.data || [] };

    } catch (error) {
        console.error('Error fetching facebook permissions:', error);
        return { success: false, permissions: [], error: 'Erro interno ao buscar permissões.' };
    }
}

export async function revokeFacebookPermission(permission: string): Promise<{ success: boolean; error?: string }> {
    try {
        const accessToken = await getFacebookAccessToken();
        if (!accessToken) {
            return { success: false, error: 'Não conectado ao Facebook.' };
        }

        const response = await fetch(`https://graph.facebook.com/${FACEBOOK_API_VERSION}/me/permissions/${permission}?access_token=${accessToken}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            const errorMsg = data.error?.message || 'Falha ao revogar permissão.';
            console.error(`Failed to revoke permission ${permission}:`, data);
            return { success: false, error: errorMsg };
        }

        revalidatePath('/account');
        return { success: true };

    } catch (error) {
        console.error(`Error revoking permission ${permission}:`, error);
        return { success: false, error: 'Erro interno ao revogar permissão.' };
    }
}
