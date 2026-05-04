

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies, users, contacts, campaigns } from '@/lib/db/schema';
import { count, eq, isNull } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Segurança: Apenas um super admin pode aceder a este endpoint.
    const session = await getUserSession();
    if (!session.user || session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

    // 1. Obter todas as empresas
    const allCompanies = await db.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.deletedAt));
    
    // 2. Contagens globais
    const [totalUsersResult] = await db.select({ value: count() }).from(users).where(isNull(users.deletedAt));
    const [totalContactsResult] = await db.select({ value: count() }).from(contacts).where(isNull(contacts.deletedAt));
    const [totalCampaignsResult] = await db.select({ value: count() }).from(campaigns);

    // 3. Contagens por empresa
    const companyStatsPromises = allCompanies.map(async (company) => {
      const [userCountResult] = await db.select({ value: count() }).from(users).where(eq(users.companyId, company.id));
      const [contactCountResult] = await db.select({ value: count() }).from(contacts).where(eq(contacts.companyId, company.id));
      const [campaignCountResult] = await db.select({ value: count() }).from(campaigns).where(eq(campaigns.companyId, company.id));
      return {
        id: company.id,
        name: company.name,
        userCount: userCountResult?.value ?? 0,
        contactCount: contactCountResult?.value ?? 0,
        campaignCount: campaignCountResult?.value ?? 0,
      };
    });

    const companyStats = await Promise.all(companyStatsPromises);

    const overallStats = {
      totalCompanies: allCompanies.length,
      totalUsers: totalUsersResult?.value ?? 0,
      totalContacts: totalContactsResult?.value ?? 0,
      totalCampaigns: totalCampaignsResult?.value ?? 0,
      companyStats,
    };

    return NextResponse.json(overallStats);

  } catch (error) {
    console.error('Erro no endpoint de Super Admin Stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}
