
'use client';

import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Users, MessageSquare, Send, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

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

const StatCard = ({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading: boolean }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{value}</div>}
        </CardContent>
    </Card>
);


export default function SuperAdminPage() {
    const [stats, setStats] = useState<OverallStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/v1/super-admin/stats');
                if (!response.ok) throw new Error('Falha ao carregar estatísticas.');
                const data = await response.json();
                setStats(data);
            } catch (error) {
                // Em uma app real, você usaria um sistema de toast para erros.
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        { title: 'Total de Empresas', value: stats?.totalCompanies ?? 0, icon: Building },
        { title: 'Total de Utilizadores', value: stats?.totalUsers ?? 0, icon: Users },
        { title: 'Total de Contatos', value: stats?.totalContacts ?? 0, icon: MessageSquare },
        { title: 'Total de Campanhas', value: stats?.totalCampaigns ?? 0, icon: Send },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Painel Super Admin"
                description="Visão geral de todas as empresas e atividades na plataforma."
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map(stat => (
                    <StatCard key={stat.title} title={stat.title} value={stat.value} icon={stat.icon} loading={loading} />
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
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                ) : stats?.companyStats.map(company => (
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
