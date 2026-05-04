'use server';

import { db } from '@/lib/db';
import { companyFinancials, companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';

export async function getCompanyFinancials(companyId: string) {
    try {
        const session = await getUserSession();
        if (session.user?.role !== 'superadmin') {
            return { success: false, error: 'Não autorizado' };
        }

        const data = await db.query.companyFinancials.findFirst({
            where: eq(companyFinancials.companyId, companyId),
        });

        // Retorna o objeto existente ou um objeto default preenchido com 0s
        if (!data) {
            return {
                success: true,
                data: {
                    companyId,
                    monthlyFee: 0,
                    implementationFee: 0,
                    fixedCosts: 0,
                    variableCosts: 0,
                    paymentDay: 10,
                    totalPaid: 0,
                }
            };
        }

        return { success: true, data: {
            ...data,
            monthlyFee: Number(data.monthlyFee),
            implementationFee: Number(data.implementationFee),
            fixedCosts: Number(data.fixedCosts),
            variableCosts: Number(data.variableCosts),
            totalPaid: Number(data.totalPaid),
        } };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] getCompanyFinancials Error:', error);
        return { success: false, error: error.message };
    }
}

export async function saveCompanyFinancials(companyId: string, data: any) {
    try {
        const session = await getUserSession();
        if (session.user?.role !== 'superadmin') {
            return { success: false, error: 'Não autorizado' };
        }

        // Validação da empresa
        const orgExists = await db.query.companies.findFirst({
            where: eq(companies.id, companyId),
        });

        if (!orgExists) {
            return { success: false, error: 'Empresa não encontrada' };
        }

        const numericData = {
            monthlyFee: String(data.monthlyFee || 0),
            implementationFee: String(data.implementationFee || 0),
            fixedCosts: String(data.fixedCosts || 0),
            variableCosts: String(data.variableCosts || 0),
            paymentDay: Number(data.paymentDay || 10),
            totalPaid: String(data.totalPaid || 0),
            lastPaymentDate: data.lastPaymentDate ? new Date(data.lastPaymentDate) : null,
        };

        // Correção do Upsert: como companyId não é marcado como unique na DB, vamos verificar se já existe e fazer update
        const existing = await db.query.companyFinancials.findFirst({
            where: eq(companyFinancials.companyId, companyId)
        });

        if (existing) {
            await db.update(companyFinancials)
                .set({ ...numericData, updatedAt: new Date() })
                .where(eq(companyFinancials.companyId, companyId));
        } else {
            await db.insert(companyFinancials)
                .values({ companyId, ...numericData });
        }

        return { success: true };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] saveCompanyFinancials Error:', error);
        return { success: false, error: error.message };
    }
}
