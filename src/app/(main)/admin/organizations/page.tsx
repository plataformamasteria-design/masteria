import { listAllOrganizations } from '@/app/actions/superadmin-actions';
import { redirect } from 'next/navigation';
import { OrganizationsClient } from './organizations-client';
import { getUserSession } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage() {
    // Validação extra por segurança (o layout também já verifica)
    const session = await getUserSession();
    if (session.user?.role !== 'superadmin') {
        redirect('/dashboard');
    }

    const { success, data, error } = await listAllOrganizations();

    if (!success || !data) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center">
                <p className="text-red-500 font-bold mb-2">Erro ao tentar listar superadmin</p>
                <p className="text-sm text-muted-foreground">{error || "Falha desconhecida."}</p>
            </div>
        );
    }

    return (
        <div className="h-full flex-1 bg-background flex flex-col min-h-0 w-full overflow-hidden">
            <OrganizationsClient initialData={data} currentCompanyId={session.user?.companyId} />
        </div>
    );
}
