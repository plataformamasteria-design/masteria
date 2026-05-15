'use server';

import { db } from '@/lib/db';
import { companies, users, connections, contacts, companyQuotas, companyCredentials, companyFinancials, systemSettings } from '@/lib/db/schema';
import { eq, sql, count, inArray, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';

/**
 * Interface de Organização enxuta para a view Superadmin
 */
export interface MasterOrg {
    id: string;
    name: string;
    slug: string;
    website: string | null;
    active: boolean;
    createdAt: string;
    // quotas/stats limitadas
    userCount: number;
    connectionCount: number;
    contactCount: number;
    maxContacts: number;
    maxMessages: number;
    maxTokens: number;
    isStarred?: boolean;
    trialEndsAt: string | null;
    lifetime: boolean;
}

const requireSuperadmin = async () => {
    const session = await getUserSession();
    if (session.error || !session.user) throw new Error("Acesso negado: Sessão inválida.");
    if (session.user.role !== 'superadmin') throw new Error("Acesso negado: Perfil insuficiente.");
    return session.user;
};

export async function listAllOrganizations(): Promise<{ success: boolean; data?: MasterOrg[]; error?: string }> {
    try {
        await requireSuperadmin();

        const orgsData = await db.select({
            company: companies,
            quota: companyQuotas,
            usersCount: sql<number>`(SELECT COUNT(*)::int FROM ${users} WHERE ${users.companyId} = ${companies.id})`,
            leadsCount: sql<number>`(SELECT COUNT(*)::int FROM ${contacts} WHERE ${contacts.companyId} = ${companies.id})`,
            connectionsCount: sql<number>`(SELECT COUNT(*)::int FROM ${connections} WHERE ${connections.companyId} = ${companies.id})`,
        })
        .from(companies)
        .leftJoin(companyQuotas, eq(companyQuotas.companyId, companies.id))
        .orderBy(desc(companies.isStarred), desc(companies.createdAt));

        const mapped: MasterOrg[] = orgsData.map(row => {
            const org = row.company;
            const qt = row.quota;
            return {
                id: org.id,
                name: org.name,
                slug: org.webhookSlug || org.id,
                website: org.website,
                active: !org.deletedAt,
                createdAt: org.createdAt.toISOString(),
                userCount: Number(row.usersCount) || 0,
                connectionCount: Number(row.connectionsCount) || 0,
                contactCount: Number(row.leadsCount) || 0,
                maxContacts: qt?.maxContacts || 500,
                maxMessages: qt?.maxMessagesPerMonth || 1000,
                maxTokens: qt?.maxAiTokens || 100000,
                isStarred: org.isStarred || false,
                trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
                lifetime: org.lifetime || false,
            };
        });

        return { success: true, data: mapped };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function assumeIdentity(targetCompanyId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const adminUser = await requireSuperadmin();

        if (!adminUser.id) throw new Error("Superadmin user id não encontrado.");

        const [targetCompany] = await db.select().from(companies).where(eq(companies.id, targetCompanyId));
        if (!targetCompany) throw new Error("Empresa destino não encontrada.");

        await db.update(users).set({
            companyId: targetCompanyId
        }).where(eq(users.id, adminUser.id));

        // Note: Com o patch em actions.ts, o JWT continuará sendo lido normalmente devido ao papel (role) ser superadmin.
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// === NOVAS AÇÕES (Gestão De Quotas e Status) ===

export async function toggleOrganizationStatus(companyId: string, isActive: boolean): Promise<{success: boolean, error?: string}> {
    try {
        await requireSuperadmin();
        // Deletamos virtualmente ou restauramos via deletedAt
        await db.update(companies).set({
            deletedAt: isActive ? null : new Date()
        }).where(eq(companies.id, companyId));
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function restoreSuperadminIdentity(): Promise<{success: boolean, error?: string}> {
    try {
        await requireSuperadmin();
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function createOrganization(data: { name: string, slug?: string, maxContacts?: number, maxMessages?: number }): Promise<{success: boolean, orgId?: string, error?: string}> {
    try {
        await requireSuperadmin();
        
        // Criar empresa
        const [{ id }] = await db.insert(companies).values({
            name: data.name,
            webhookSlug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        }).returning({ id: companies.id });

        // Inicializar quotas
        await db.insert(companyQuotas).values({
            companyId: id,
            maxContacts: data.maxContacts || 500,
            maxMessagesPerMonth: data.maxMessages || 1000,
        });

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true, orgId: id };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateOrganizationQuotas(companyId: string, quotas: { maxContacts: number, maxMessages: number, maxTokens: number }): Promise<{success: boolean, error?: string}> {
    try {
        await requireSuperadmin();
        
        await db.update(companyQuotas)
          .set({
              maxContacts: quotas.maxContacts,
              maxMessagesPerMonth: quotas.maxMessages,
              maxAiTokens: quotas.maxTokens,
          })
          .where(eq(companyQuotas.companyId, companyId));

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function getCompanyDetails(companyId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        await requireSuperadmin();
        
        const [credentials] = await db.select().from(companyCredentials).where(eq(companyCredentials.companyId, companyId));
        const [financials] = await db.select().from(companyFinancials).where(eq(companyFinancials.companyId, companyId));

        const maskKey = (key: string | null) => key ? `${key.substring(0, 8)}...${key.slice(-4)}` : '';

        return {
            success: true,
            data: {
                credentials: credentials ? {
                    openaiApiKey: maskKey(credentials.openaiApiKey),
                    geminiApiKey: maskKey(credentials.geminiApiKey),
                    elevenlabsApiKey: maskKey(credentials.elevenlabsApiKey),
                    hasOpenAI: !!credentials.openaiApiKey,
                    hasGemini: !!credentials.geminiApiKey,
                    hasElevenLabs: !!credentials.elevenlabsApiKey,
                } : null,
                financials: financials || null,
            }
        };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateCompanyCredentials(companyId: string, data: { openaiApiKey?: string, geminiApiKey?: string, elevenlabsApiKey?: string }): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        
        const toUpdate: any = {};
        if (data.openaiApiKey && !data.openaiApiKey.includes('...')) toUpdate.openaiApiKey = data.openaiApiKey;
        if (data.geminiApiKey && !data.geminiApiKey.includes('...')) toUpdate.geminiApiKey = data.geminiApiKey;
        if (data.elevenlabsApiKey && !data.elevenlabsApiKey.includes('...')) toUpdate.elevenlabsApiKey = data.elevenlabsApiKey;

        const existing = await db.select().from(companyCredentials).where(eq(companyCredentials.companyId, companyId));
        
        if (existing.length > 0) {
            if (Object.keys(toUpdate).length > 0) {
                await db.update(companyCredentials).set({
                    ...toUpdate,
                    updatedAt: new Date()
                }).where(eq(companyCredentials.companyId, companyId));
            }
        } else {
            await db.insert(companyCredentials).values({
                companyId,
                ...toUpdate
            });
        }
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateCompanyFinancials(companyId: string, data: { monthlyFee?: number, implementationFee?: number, fixedCosts?: number, variableCosts?: number, paymentDay?: number }): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        
        const existing = await db.select().from(companyFinancials).where(eq(companyFinancials.companyId, companyId));
        if (existing.length > 0) {
            await db.update(companyFinancials).set({
                monthlyFee: data.monthlyFee !== undefined ? data.monthlyFee.toString() : existing[0].monthlyFee,
                implementationFee: data.implementationFee !== undefined ? data.implementationFee.toString() : existing[0].implementationFee,
                fixedCosts: data.fixedCosts !== undefined ? data.fixedCosts.toString() : existing[0].fixedCosts,
                variableCosts: data.variableCosts !== undefined ? data.variableCosts.toString() : existing[0].variableCosts,
                paymentDay: data.paymentDay !== undefined ? data.paymentDay : existing[0].paymentDay,
                updatedAt: new Date()
            }).where(eq(companyFinancials.companyId, companyId));
        } else {
            await db.insert(companyFinancials).values({
                companyId,
                monthlyFee: data.monthlyFee !== undefined ? data.monthlyFee.toString() : '0',
                implementationFee: data.implementationFee !== undefined ? data.implementationFee.toString() : '0',
                fixedCosts: data.fixedCosts !== undefined ? data.fixedCosts.toString() : '0',
                variableCosts: data.variableCosts !== undefined ? data.variableCosts.toString() : '0',
                paymentDay: data.paymentDay || 10,
            });
        }
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSystemSettings(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
        await requireSuperadmin();
        
        const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, 'global'));

        const maskKey = (key: string | null) => key ? `${key.substring(0, 8)}...${key.slice(-4)}` : '';

        return {
            success: true,
            data: settings ? {
                openaiApiKey: maskKey(settings.openaiApiKey),
                geminiApiKey: maskKey(settings.geminiApiKey),
                elevenlabsApiKey: maskKey(settings.elevenlabsApiKey),
                hasOpenAI: !!settings.openaiApiKey,
                hasGemini: !!settings.geminiApiKey,
                hasElevenLabs: !!settings.elevenlabsApiKey,
            } : null
        };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateSystemSettings(data: { openaiApiKey?: string, geminiApiKey?: string, elevenlabsApiKey?: string }): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        
        const toUpdate: any = {};
        if (data.openaiApiKey && !data.openaiApiKey.includes('...')) toUpdate.openaiApiKey = data.openaiApiKey;
        if (data.geminiApiKey && !data.geminiApiKey.includes('...')) toUpdate.geminiApiKey = data.geminiApiKey;
        if (data.elevenlabsApiKey && !data.elevenlabsApiKey.includes('...')) toUpdate.elevenlabsApiKey = data.elevenlabsApiKey;

        const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 'global'));
        
        if (existing.length > 0) {
            if (Object.keys(toUpdate).length > 0) {
                await db.update(systemSettings).set({
                    ...toUpdate,
                    updatedAt: new Date()
                }).where(eq(systemSettings.id, 'global'));
            }
        } else {
            await db.insert(systemSettings).values({
                id: 'global',
                ...toUpdate
            });
        }
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteOrganization(companyId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        await db.delete(companies).where(eq(companies.id, companyId));
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateOrganizationTrial(companyId: string, trialEndsAt: Date | null): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        await db.update(companies).set({ trialEndsAt }).where(eq(companies.id, companyId));
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function toggleOrganizationLifetime(companyId: string, lifetime: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        await requireSuperadmin();
        await db.update(companies).set({ lifetime }).where(eq(companies.id, companyId));
        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}

export async function getOrganizationUsers(companyId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        await requireSuperadmin();
        const orgUsers = await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            createdAt: users.createdAt,
            avatarUrl: users.avatarUrl,
        }).from(users).where(eq(users.companyId, companyId)).orderBy(desc(users.createdAt));
        return { success: true, data: orgUsers };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
}
