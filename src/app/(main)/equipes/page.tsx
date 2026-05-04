import { TeamsPageClient } from "@/components/teams/teams-page-client";
import { getTeams, getCompanyUsers } from "@/app/actions/teams";

export const metadata = {
    title: "Gerenciar Equipes - MasterIA",
};

export default async function TeamsPage() {
    const initialTeams = await getTeams();
    const allUsers = await getCompanyUsers();

    return (
        <div className="flex-1 w-full p-4 md:p-6 lg:p-8 shrink-0 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Equipes e Departamentos</h1>
                        <p className="text-muted-foreground">Gerencie seus times, atribua contatos e defina seus setores de atendimento.</p>
                    </div>
                </div>
                <TeamsPageClient initialTeams={initialTeams} allUsers={allUsers} />
            </div>
        </div>
    );
}
