'use server';

import { db } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCompanyIdFromSession } from "@/app/actions";
import { decrypt } from "@/lib/crypto";

export async function getMetaPendingAccounts(connectionId: string) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) throw new Error("Não autorizado");

        // Buscar conexão e token seguro
        const [conn] = await db.select().from(connections)
            .where(and(
                eq(connections.id, connectionId),
                eq(connections.companyId, companyId),
                eq(connections.wabaId, 'PENDING_OAUTH')
            )).limit(1);

        if (!conn || !conn.accessToken) {
            throw new Error("Conexão Pendente não encontrada ou Token Ausente");
        }

        const token = decrypt(conn.accessToken);

        // Fetch businesses (o usuário pode ter acesso a vários BMs)
        const bizRes = await fetch(`https://graph.facebook.com/v20.0/me/businesses?access_token=${token}`);
        const bizData = await bizRes.json();
        const businesses = bizData.data || [];

        const allWabas: any[] = [];
        const adAccounts: any[] = []; // Opcional para Aba Marketing

        // Para cada Business, buscar as WABA (WhatsApp Business Accounts) e Contas de Anúncio
        for (const biz of businesses) {
            // Buscando WABAs
            const wabaRes = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/owned_whatsapp_business_accounts?access_token=${token}`);
            const wabaData = await wabaRes.json();

            if (wabaData.data) {
                for (const waba of wabaData.data) {
                    // Para cada WABA, buscar telefones vinculados
                    const phoneRes = await fetch(`https://graph.facebook.com/v20.0/${waba.id}/phone_numbers?access_token=${token}`);
                    const phoneData = await phoneRes.json();

                    const phones = phoneData.data || [];
                    allWabas.push({
                        waba_id: waba.id,
                        name: waba.name,
                        business_name: biz.name,
                        phones: phones.map((p: any) => ({
                            id: p.id,
                            display_phone_number: p.display_phone_number,
                            verified_name: p.verified_name
                        }))
                    });
                }
            }

            // Buscando Client Ad Accounts (Para Marketing)
            const adRes = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/client_ad_accounts?access_token=${token}&fields=name,account_id,account_status`);
            const adData = await adRes.json();
            if (adData.data) {
                adData.data.forEach((ad: any) => {
                    adAccounts.push({
                        id: ad.account_id, // Importante: Graph Ads usa 'act_XX', mas return accounts vem formatado as vezes. 
                        raw_id: ad.id,
                        name: ad.name,
                        business_name: biz.name,
                        status: ad.account_status
                    });
                });
            }
        }

        const fallbackAdAccountsRes = await fetch(`https://graph.facebook.com/v20.0/me/adaccounts?fields=name,account_id,account_status&access_token=${token}`);
        const fAdData = await fallbackAdAccountsRes.json();
        if (fAdData.data) {
            fAdData.data.forEach((ad: any) => {
                if (!adAccounts.find(a => a.id === ad.account_id)) {
                    adAccounts.push({ id: ad.account_id, raw_id: ad.id, name: ad.name, business_name: 'Pessoal/Direto', status: ad.account_status });
                }
            });
        }

        return { success: true, wabas: allWabas, adAccounts };

    } catch (e: any) {
        console.error("Fetch Graph Error:", e);
        return { success: false, error: e.message };
    }
}

export async function finishMetaOAuthSetup(connectionId: string, payload: { wabaId: string, phoneId: string, adAccountId?: string }) {
    try {
        const companyId = await getCompanyIdFromSession();
        if (!companyId) throw new Error("Não autorizado");

        // Remove qualquer outra conexão Meta_API para não haver duplicação conflituosa principal
        await db.delete(connections).where(and(
            eq(connections.connectionType, 'meta_api'),
            eq(connections.companyId, companyId),
            eq(connections.wabaId, payload.wabaId) // Se já existe mesma WABA, remove (ou se atualizar a atual)
        ));

        await db.update(connections).set({
            wabaId: payload.wabaId,
            phoneNumberId: payload.phoneId,
            isActive: true,
            config_name: `WhatsApp Oficial (${payload.phoneId})`,
            lastConnected: new Date()
            // O adAccountId poderia aqui ser injetado em marketingCredentials ou numa coluna própria
        }).where(and(
            eq(connections.id, connectionId),
            eq(connections.companyId, companyId) // Segurança
        ));

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
