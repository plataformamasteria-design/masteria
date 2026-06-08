import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Users, MessageSquare, Send } from 'lucide-react';
import { db } from '@/lib/db';
import { companies, users, contacts, campaigns } from '@/lib/db/schema';
import { count, eq, isNull } from 'drizzle-orm';
import { getUserSession } from '@/app/actions';
import { redirect } from 'next/navigation';

interface CompanyStat {
    id: string;
    name: string;
    userCount: number;
    contactCount: number;
    campaignCount: number;
}

interface OverallStats {
    totalCompanies: number;
    totalUsers: number;
    totalContacts: number;
    totalCampaigns: number;
    companyStats: CompanyStat[];
}

const StatCard = ({ title, value, icon: Icon }: { title: string, value: string | number, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);


export default async function SuperAdminPage() {
    const session = await getUserSession();
    if (!session.user || session.user.role !== 'superadmin') {
      redirect('/');
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

    const stats = {
      totalCompanies: allCompanies.length,
      totalUsers: totalUsersResult?.value ?? 0,
      totalContacts: totalContactsResult?.value ?? 0,
      totalCampaigns: totalCampaignsResult?.value ?? 0,
      companyStats,
    };

    const statCards = [
        { title: 'Total de Empresas', value: stats.totalCompanies, icon: Building },
        { title: 'Total de Utilizadores', value: stats.totalUsers, icon: Users },
        { title: 'Total de Contatos', value: stats.totalContacts, icon: MessageSquare },
        { title: 'Total de Campanhas', value: stats.totalCampaigns, icon: Send },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Painel Super Admin"
                description="Visão geral de todas as empresas e atividades na plataforma."
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map(stat => (
                    <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} />
                ))}
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Estatísticas por Empresa</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead className="text-center">Utilizadores</TableHead>
                                    <TableHead className="text-center">Contatos</TableHead>
                                    <TableHead className="text-center">Campanhas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.companyStats.map(company => (
                                    <TableRow key={company.id}>
                                        <TableCell className="font-medium">{company.name}</TableCell>
                                        <TableCell className="text-center">{company.userCount}</TableCell>
                                        <TableCell className="text-center">{company.contactCount}</TableCell>
                                        <TableCell className="text-center">{company.campaignCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
