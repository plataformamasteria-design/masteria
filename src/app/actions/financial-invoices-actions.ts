'use server';

import { db } from '@/lib/db';
import { companies, companyMonthlyInvoices, messages, companyFinancials } from '@/lib/db/schema';
import { eq, and, sql, desc, isNull, lt } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';
import { revalidatePath } from 'next/cache';

const COST_PER_1K_TOKENS = 0.05; // R$ 0,05 por 1k tokens

const requireSuperadmin = async () => {
    const session = await getUserSession();
    if (session.error || !session.user) throw new Error("Acesso negado: Sessão inválida.");
    if (session.user.role !== 'superadmin') throw new Error("Acesso negado: Perfil insuficiente.");
    return session.user;
};

// Obter a lista de faturas para um determinado mês
export async function getMonthlyInvoices(monthYear: string) {
    try {
        await requireSuperadmin();
        
        // Pega as faturas do mês e faz o join com a tabela de empresas
        const invoices = await db.select({
            invoice: companyMonthlyInvoices,
            company: {
                id: companies.id,
                name: companies.name,
                avatarUrl: companies.avatarUrl,
                slug: companies.webhookSlug,
                active: companies.active
            }
        })
        .from(companyMonthlyInvoices)
        .innerJoin(companies, eq(companyMonthlyInvoices.companyId, companies.id))
        .where(eq(companyMonthlyInvoices.monthYear, monthYear))
        .orderBy(desc(companyMonthlyInvoices.createdAt));

        return { success: true, data: invoices };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] getMonthlyInvoices Error:', error);
        return { success: false, error: error.message };
    }
}

// Gera ou atualiza faturas do mês atual para todas as empresas ativas
export async function generateOrUpdateCurrentMonthInvoices() {
    try {
        await requireSuperadmin();
        
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const allCompanies = await db.select().from(companies);
        const financials = await db.select().from(companyFinancials);
        
        // Vamos calcular os tokens usados neste mês
        // Pega o início do mês atual
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        for (const company of allCompanies) {
            // Conta os tokens usados neste mês para a empresa
            const tokensUsedResult = await db.select({ totalTokens: sql<number>`sum(${messages.aiTokensUsed})` })
                .from(messages)
                .where(
                    and(
                        eq(messages.companyId, company.id),
                        sql`${messages.sentAt} >= ${startOfMonth.toISOString()}`
                    )
                );
            
            const totalTokens = tokensUsedResult[0]?.totalTokens || 0;
            const variableCosts = (totalTokens / 1000) * COST_PER_1K_TOKENS;
            
            const fin = financials.find(f => f.companyId === company.id);
            const monthlyFee = fin?.monthlyFee ? Number(fin.monthlyFee) : 0;
            const fixedCosts = fin?.fixedCosts ? Number(fin.fixedCosts) : 0;
            const paymentDay = fin?.paymentDay || 10;
            
            // Calcula o Due Date deste mês
            const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), paymentDay);
            const totalAmount = monthlyFee + variableCosts;
            const netProfit = totalAmount - fixedCosts - variableCosts;

            // Upsert na fatura
            const existingInvoice = await db.query.companyMonthlyInvoices.findFirst({
                where: and(
                    eq(companyMonthlyInvoices.companyId, company.id),
                    eq(companyMonthlyInvoices.monthYear, monthYear)
                )
            });

            if (existingInvoice) {
                // Atualiza APENAS se não estiver paga, para não mexer em faturas consolidadas
                if (existingInvoice.status === 'PENDING') {
                    // Verifica se já está atrasada
                    const status = (now > paymentDueDate) ? 'OVERDUE' : 'PENDING';

                    await db.update(companyMonthlyInvoices)
                        .set({
                            aiTokensUsed: totalTokens,
                            variableCosts: String(variableCosts),
                            totalAmount: String(totalAmount),
                            netProfit: String(netProfit),
                            status: status,
                            updatedAt: new Date()
                        })
                        .where(eq(companyMonthlyInvoices.id, existingInvoice.id));
                }
            } else {
                // Cria a fatura do mês
                await db.insert(companyMonthlyInvoices).values({
                    companyId: company.id,
                    monthYear,
                    monthlyFee: String(monthlyFee),
                    fixedCosts: String(fixedCosts),
                    variableCosts: String(variableCosts),
                    aiTokensUsed: totalTokens,
                    totalAmount: String(totalAmount),
                    netProfit: String(netProfit),
                    paymentDueDate: paymentDueDate.toISOString().split('T')[0],
                    status: (now > paymentDueDate) ? 'OVERDUE' : 'PENDING'
                });
            }
        }

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] generateOrUpdateCurrentMonthInvoices Error:', error);
        return { success: false, error: error.message };
    }
}

// Atualizar manualmente um valor da fatura (Gastos fixos ou Mensalidade)
export async function updateInvoiceValue(invoiceId: string, field: 'monthlyFee' | 'fixedCosts', value: number) {
    try {
        await requireSuperadmin();
        
        const invoice = await db.query.companyMonthlyInvoices.findFirst({ where: eq(companyMonthlyInvoices.id, invoiceId) });
        if (!invoice) throw new Error("Fatura não encontrada");

        const updatedData: any = {
            [field]: String(value),
            updatedAt: new Date()
        };

        // Recalcular totais
        const monthlyFee = field === 'monthlyFee' ? value : Number(invoice.monthlyFee);
        const fixedCosts = field === 'fixedCosts' ? value : Number(invoice.fixedCosts);
        const variableCosts = Number(invoice.variableCosts);

        updatedData.totalAmount = String(monthlyFee + variableCosts);
        updatedData.netProfit = String(monthlyFee + variableCosts - fixedCosts - variableCosts);

        await db.update(companyMonthlyInvoices)
            .set(updatedData)
            .where(eq(companyMonthlyInvoices.id, invoiceId));

        // Refletir as mudanças na tabela de configs gerais da empresa também
        if (field === 'monthlyFee') {
            await db.update(companyFinancials).set({ monthlyFee: String(value) }).where(eq(companyFinancials.companyId, invoice.companyId));
        } else if (field === 'fixedCosts') {
            await db.update(companyFinancials).set({ fixedCosts: String(value) }).where(eq(companyFinancials.companyId, invoice.companyId));
        }

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] updateInvoiceValue Error:', error);
        return { success: false, error: error.message };
    }
}

// Alterar status de pagamento
export async function updateInvoiceStatus(invoiceId: string, status: 'PENDING' | 'PAID' | 'OVERDUE') {
    try {
        await requireSuperadmin();
        
        const paidAt = status === 'PAID' ? new Date() : null;

        await db.update(companyMonthlyInvoices)
            .set({ status, paidAt, updatedAt: new Date() })
            .where(eq(companyMonthlyInvoices.id, invoiceId));

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] updateInvoiceStatus Error:', error);
        return { success: false, error: error.message };
    }
}

// Executa o bloqueio de empresas com fatura vencida há mais de 10 dias
export async function lockoutOverdueCompanies() {
    try {
        await requireSuperadmin();
        
        const now = new Date();
        const tenDaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
        const formattedTenDaysAgo = tenDaysAgo.toISOString().split('T')[0];

        // Busca faturas não pagas que o vencimento foi ANTES de 10 dias atrás
        const overdueInvoices = await db.select().from(companyMonthlyInvoices)
            .where(
                and(
                    eq(companyMonthlyInvoices.status, 'OVERDUE'),
                    isNull(companyMonthlyInvoices.paidAt),
                    sql`${companyMonthlyInvoices.paymentDueDate} < ${formattedTenDaysAgo}`
                )
            );

        let blockedCount = 0;
        
        for (const invoice of overdueInvoices) {
            const company = await db.query.companies.findFirst({ where: eq(companies.id, invoice.companyId) });
            if (company && company.active) {
                // Bloquear empresa
                await db.update(companies).set({ active: false }).where(eq(companies.id, company.id));
                blockedCount++;
            }
        }

        revalidatePath('/(main)/admin/organizations', 'page');
        return { success: true, message: `${blockedCount} empresas bloqueadas por inadimplência.` };
    } catch (error: any) {
        console.error('[FINANCIAL_ACTIONS] lockoutOverdueCompanies Error:', error);
        return { success: false, error: error.message };
    }
}
