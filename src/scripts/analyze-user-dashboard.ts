// src/scripts/analyze-user-dashboard.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';

const TARGET_EMAIL = 'diegomaninhu@gmail.com';

async function main() {
    console.log(`\nStarting analysis for: ${TARGET_EMAIL}`);
    const report: any = {
        email: TARGET_EMAIL,
        timestamp: new Date().toISOString(),
        data: {}
    };

    try {
        // 1. Get User and Company ID
        console.log('Fetching user info...');
        const userResult = await db.execute(sql`SELECT id, name, email, company_id, role, created_at FROM users WHERE email = ${TARGET_EMAIL} LIMIT 1`);
        if (userResult.length === 0) {
            console.log(`❌ User not found: ${TARGET_EMAIL}`);
            process.exit(1);
        }
        const user = userResult[0] as any;
        report.user = user;
        const companyId = user.company_id;

        // 2. Company Info
        console.log('Fetching company info...');
        const companyResult = await db.execute(sql`SELECT id, name, webhook_slug FROM companies WHERE id = ${companyId} LIMIT 1`);
        report.company = companyResult[0];

        // 3. Contacts
        console.log('Analyzing contacts...');
        const contactTotal = await db.execute(sql`SELECT count(*) FROM contacts WHERE company_id = ${companyId}`);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const contactNew = await db.execute(sql`SELECT count(*) FROM contacts WHERE company_id = ${companyId} AND created_at >= ${startOfMonth.toISOString()}::timestamp`);

        report.data.contacts = {
            total: Number((contactTotal[0] as any).count),
            newSinceStartOfMonth: Number((contactNew[0] as any).count)
        };

        // 4. Conversations
        console.log('Analyzing conversations...');
        const convStats = await db.execute(sql`SELECT status, count(*) as count FROM conversations WHERE company_id = ${companyId} GROUP BY status`);
        const pending = await db.execute(sql`SELECT count(*) FROM conversations WHERE company_id = ${companyId} AND status IN ('NEW', 'IN_PROGRESS')`);

        report.data.conversations = {
            byStatus: (convStats as any[]).reduce((acc, curr) => ({ ...acc, [curr.status || 'NULL']: Number(curr.count) }), {}),
            total: (convStats as any[]).reduce((acc, curr) => acc + Number(curr.count), 0),
            pending: Number((pending[0] as any).count)
        };

        // 5. Messages
        console.log('Analyzing messages (might take a moment)...');
        const msgStats = await db.execute(sql`
            SELECT m.sender_type, count(*) as count 
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.company_id = ${companyId}
            GROUP BY m.sender_type
        `);

        let sentCount = 0;
        const bySender: Record<string, number> = {};
        (msgStats as any[]).forEach(r => {
            const st = r.sender_type || 'NULL';
            const c = Number(r.count);
            bySender[st] = c;
            if (['AGENT', 'AI', 'SYSTEM'].includes(st)) {
                sentCount += c;
            }
        });

        report.data.messages = {
            total: (msgStats as any[]).reduce((acc, curr) => acc + Number(curr.count), 0),
            bySender,
            sentByApp: sentCount
        };

        // 6. Leads Value
        console.log('Analyzing leads value...');
        const leadStats = await db.execute(sql`SELECT count(*) as count, SUM(CAST(value AS numeric)) as total_value FROM kanban_leads WHERE board_id IN (SELECT id FROM kanban_boards WHERE company_id = ${companyId})`);

        report.data.leads = {
            count: Number((leadStats[0] as any).count),
            totalValue: Number((leadStats[0] as any).total_value || 0)
        };

        // 7. Historical Trends (Last 30 Days)
        console.log('Analyzing historical trends...');
        const trendResult = await db.execute(sql`
            SELECT DATE(created_at) as date, count(*) as count
            FROM conversations
            WHERE company_id = ${companyId}
            AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `);

        report.data.trend = (trendResult as any[]).map(r => {
            const d = r.date instanceof Date ? r.date : new Date(r.date);
            return {
                date: d.toISOString().split('T')[0],
                count: Number(r.count)
            };
        });

        // 8. Campaigns & Automations
        const campaignCount = await db.execute(sql`SELECT count(*) FROM campaigns WHERE company_id = ${companyId}`);
        const automationCount = await db.execute(sql`SELECT count(*) FROM automation_rules WHERE company_id = ${companyId}`);

        report.data.campaigns = Number((campaignCount[0] as any).count);
        report.data.automations = Number((automationCount[0] as any).count);

        // Write to file
        fs.writeFileSync('dashboard-full-analysis.json', JSON.stringify(report, null, 2));
        console.log('\n✅ Analysis complete! Results saved to dashboard-full-analysis.json');

    } catch (err) {
        console.error('\n❌ ERROR DURING ANALYSIS:', err);
    }
    process.exit(0);
}

main().catch(console.error);
