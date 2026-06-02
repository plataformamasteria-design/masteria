import { TeamsPageClient } from "@/components/teams/teams-page-client";
import { getTeams, getCompanyUsers } from "@/app/actions/teams";

export const metadata = {
    title: "Gerenciar Equipes - MasterIA",
};

export default async function TeamsPage() {
    const initialTeams = await getTeams();
    const allUsers = await getCompanyUsers();

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-transparent">
            {/* HEADER PRINCIPAL */}
            <div className="px-8 py-5 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20 backdrop-blur-xl flex justify-between items-center sticky top-0 z-10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground drop-shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        Equipes e Departamentos
                    </h1>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Gerencie seus times, atribua contatos e defina seus setores de atendimento.</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    <TeamsPageClient initialTeams={initialTeams} allUsers={allUsers} />
                </div>
            </div>
        </div>
    );
}
