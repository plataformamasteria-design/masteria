import 'dotenv/config';
import { db } from '../src/lib/db/index.js';
import { companies, companyMonthlyInvoices, companyFinancials } from '../src/lib/db/schema.js';
import { eq, and } from 'drizzle-orm';

async function seedInvoices() {
    console.log('Seeding initial invoices for current month...');
    try {
        const now = new Date();
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const allCompanies = await db.select().from(companies);
        const financials = await db.select().from(companyFinancials);
        
        let created = 0;

        for (const company of allCompanies) {
            const fin = financials.find(f => f.companyId === company.id);
            const monthlyFee = fin?.monthlyFee ? Number(fin.monthlyFee) : 0;
            const fixedCosts = fin?.fixedCosts ? Number(fin.fixedCosts) : 0;
            const paymentDay = fin?.paymentDay || 10;
            
            const paymentDueDate = new Date(now.getFullYear(), now.getMonth(), paymentDay);
            const totalAmount = monthlyFee; // base without tokens initially
            const netProfit = totalAmount - fixedCosts;

            const existing = await db.query.companyMonthlyInvoices.findFirst({
                where: and(
                    eq(companyMonthlyInvoices.companyId, company.id),
                    eq(companyMonthlyInvoices.monthYear, monthYear)
                )
            });

            if (!existing) {
                await db.insert(companyMonthlyInvoices).values({
                    companyId: company.id,
                    monthYear,
                    monthlyFee: String(monthlyFee),
                    fixedCosts: String(fixedCosts),
                    variableCosts: "0",
                    aiTokensUsed: 0,
                    totalAmount: String(totalAmount),
                    netProfit: String(netProfit),
                    paymentDueDate: paymentDueDate.toISOString().split('T')[0],
                    status: (now > paymentDueDate) ? 'OVERDUE' : 'PENDING'
                });
                created++;
            }
        }
        console.log(`Successfully created ${created} invoices for ${monthYear}.`);
    } catch (err) {
        console.error('Failed to seed invoices:', err);
    }
    process.exit(0);
}

seedInvoices();
