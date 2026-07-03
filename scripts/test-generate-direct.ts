import 'dotenv/config';
import { db } from '../src/lib/db/index.js';
import { companies, companyMonthlyInvoices, messages, companyFinancials } from '../src/lib/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';

const COST_PER_1K_TOKENS = 0.05; 

async function test() {
    try {
        console.log("Fetching companies and financials...");
        const allCompanies = await db.select().from(companies);
        const financials = await db.select().from(companyFinancials);
        
        console.log(`Found ${allCompanies.length} companies, ${financials.length} financials`);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        for (const company of allCompanies) {
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
            
            const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), paymentDay);
            const totalAmount = monthlyFee + variableCosts;
            const netProfit = totalAmount - fixedCosts - variableCosts;

            const existingInvoice = await db.query.companyMonthlyInvoices.findFirst({
                where: and(
                    eq(companyMonthlyInvoices.companyId, company.id),
                    eq(companyMonthlyInvoices.monthYear, monthYear)
                )
            });

            if (existingInvoice) {
                if (existingInvoice.status === 'PENDING') {
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
        console.log("Done generating invoices.");
    } catch(err) {
        console.error("ERROR OCCURRED:");
        console.error(err);
    }
}
test();
