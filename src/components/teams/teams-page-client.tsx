"use client"

import { useState } from "react";
import { Plus, Users, Settings2, Trash2, ShieldAlert, Edit2, PauseCircle, PlayCircle, MoreVertical } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createTeam, deleteTeam, getTeams, updateTeam } from "@/app/actions/teams";
import { toast } from "@/hooks/use-toast";
import { TeamMembersDialog } from "./team-members-dialog";

export function TeamsPageClient({ initialTeams, allUsers }: { initialTeams: any[], allUsers: any[] }) {
    // SWR fetcher para garantir dados em tempo real
    const { data: teams = initialTeams, mutate } = useSWR('teams-list', async () => await getTeams(), { 
        fallbackData: initialTeams,
        revalidateOnFocus: true
    });

    // Create State
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDesc, setNewTeamDesc] = useState("");

    // Edit State
    const [teamToEdit, setTeamToEdit] = useState<any | null>(null);
    const [editTeamName, setEditTeamName] = useState("");
    const [editTeamDesc, setEditTeamDesc] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Delete State
    const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return toast({ variant: "destructive", title: "Nome obrigatório" });
        setIsCreating(true);
        try {
            await createTeam(newTeamName, newTeamDesc);
            await mutate(); // Revalida dados
            setNewTeamName("");
            setNewTeamDesc("");
            setIsCreateOpen(false);
            toast({ title: "Equipe criada com sucesso!" });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao criar", description: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally { setIsCreating(false); }
    }

    const openEditModal = (team: any) => {
        setTeamToEdit(team);
        setEditTeamName(team.name);
        setEditTeamDesc(team.description || "");
    }

    const handleEditTeam = async () => {
        if (!teamToEdit) return;
        if (!editTeamName.trim()) return toast({ variant: "destructive", title: "Nome obrigatório" });
        
        setIsEditing(true);
        try {
            await updateTeam(teamToEdit.id, { name: editTeamName, description: editTeamDesc });
            await mutate(); // Atualiza lista global
            setTeamToEdit(null);
            toast({ title: "Equipe atualizada!" });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao editar", description: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally { setIsEditing(false); }
    }

    const handleToggleActive = async (team: any) => {
        const newStatus = !team.active;
        try {
            // Optimistic update
            mutate(teams.map((t: any) => t.id === team.id ? { ...t, active: newStatus } : t), false);
            await updateTeam(team.id, { active: newStatus });
            await mutate();
            toast({ title: newStatus ? "Equipe reativada" : "Equipe pausada" });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao alterar status" });
            mutate(); // Revert em caso de falha
        }
    }

    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;

        try {
            // Optimistic deletion
            mutate(teams.filter((t: any) => t.id !== teamToDelete), false);
            await deleteTeam(teamToDelete);
            await mutate();
            setTeamToDelete(null);
            toast({ title: "Equipe removida." });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao excluir", description: e instanceof Error ? e.message : "Erro desconhecido" });
            mutate(); // Revert
        }
    }

    return (
        <div className="space-y-8">
            {/* Header / Metrics */}
            <div className="flex justify-between items-center glass-card rounded-[2rem] overflow-hidden p-6">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                        <Users className="h-6 w-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-foreground">{teams.length} Departamento(s)</h3>
                        <p className="text-sm font-medium text-muted-foreground">Times criados na plataforma</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-11 rounded-2xl px-6 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all active:scale-95 hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]">
                            <Plus className="mr-2 h-5 w-5 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Criar Equipe
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-950/90 backdrop-blur-3xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem]">
                        <DialogHeader>
                            <DialogTitle>Novo Departamento</DialogTitle>
                            <DialogDescription>Crie uma nova área de atendimento para separar as tratativas.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label className="text-zinc-300 font-semibold">Nome da Equipe</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-emerald-500/50" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Comercial, Suporte Avançado..." />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300 font-semibold">Descrição (Opcional)</Label>
                                <Input className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-emerald-500/50" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="Agentes de Nível 1" />
                            </div>
                            <Button onClick={handleCreateTeam} disabled={isCreating} className="w-full h-11 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 mt-2">
                                {isCreating ? "Criando..." : "Confirmar e Salvar"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Teams Grid */}
            <div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in duration-500"
            >
                {teams.map((t: any) => (
                    <div
                        key={t.id}
                        className="group relative glass-card hover:border-emerald-500/30 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] hover:shadow-[0_0_30px_rgba(16,185,129,0.05)] transition-all duration-300 rounded-[2rem] p-6 flex flex-col animate-in fade-in slide-in-from-bottom-4 zoom-in-95"
                    >
                        <div className="flex justify-between items-start mb-5">
                            <div className="space-y-2 pr-6">
                                <h3 className="text-xl font-bold tracking-tight flex items-center gap-2.5 text-foreground drop-shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                    {t.name}
                                    {!t.active && (
                                        <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)] text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                                            Inativo
                                        </span>
                                    )}
                                </h3>
                                <p className="text-sm font-medium text-zinc-400 line-clamp-2">{t.description || "Nenhuma descrição fornecida."}</p>
                            </div>

                            {/* Options Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground border border-transparent hover:border-black/10 dark:hover:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.05] rounded-xl shrink-0 -mr-2 -mt-2 transition-all">
                                        <MoreVertical className="h-5 w-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-white/10 text-zinc-200 rounded-xl shadow-xl">
                                    <DropdownMenuLabel className="text-zinc-400">Opções da Equipe</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuItem onClick={() => openEditModal(t)} className="gap-2 cursor-pointer">
                                        <Edit2 className="h-4 w-4" /> Editar Detalhes
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleToggleActive(t)} className="gap-2 cursor-pointer">
                                        {t.active ? (
                                            <><PauseCircle className="h-4 w-4" /> Pausar Equipe</>
                                        ) : (
                                            <><PlayCircle className="h-4 w-4 text-emerald-500" /> Ativar Equipe</>
                                        )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setTeamToDelete(t.id)} className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer">
                                        <Trash2 className="h-4 w-4" /> Excluir Departamento
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="mt-auto border-t border-white/5 pt-5 flex items-center justify-between">
                            <TeamMembersDialog team={t} allUsers={allUsers} />
                            
                            {/* Secondary visual indicator, completely optional now that we have Dropdown */}
                            <div className="flex -space-x-2 opacity-50 grayscale group-hover:grayscale-0 transition-all">
                                {/* Visual representation of users can go here in the future */}
                            </div>
                        </div>
                    </div>
                ))}

                {teams.length === 0 && (
                    <div
                        className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[2rem] bg-white/[0.01] animate-in fade-in zoom-in-95 duration-500"
                    >
                        <div className="h-16 w-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                            <ShieldAlert className="h-8 w-8 text-zinc-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Nenhum departamento</h3>
                        <p className="text-sm font-medium text-zinc-400 mt-1">Crie sua primeira equipe para segmentar os atendimentos.</p>
                    </div>
                )}
            </div>

            {/* Modal de Edição */}
            <Dialog open={!!teamToEdit} onOpenChange={(open) => !open && setTeamToEdit(null)}>
                <DialogContent className="bg-zinc-950/90 backdrop-blur-3xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle>Editar Departamento</DialogTitle>
                        <DialogDescription>Altere as informações da equipe.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300 font-semibold">Nome da Equipe</Label>
                            <Input className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-emerald-500/50" value={editTeamName} onChange={e => setEditTeamName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-300 font-semibold">Descrição (Opcional)</Label>
                            <Input className="bg-white/5 border-white/10 text-white rounded-xl focus-visible:ring-emerald-500/50" value={editTeamDesc} onChange={e => setEditTeamDesc(e.target.value)} />
                        </div>
                        <Button onClick={handleEditTeam} disabled={isEditing} className="w-full h-11 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 mt-2">
                            {isEditing ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Exclusão */}
            <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
                <AlertDialogContent className="bg-zinc-950/90 backdrop-blur-3xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação removerá a base de membros atrelados ao time (os colaboradores não serão excluídos da plataforma, apenas desvinculados do departamento).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTeam} className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-xl font-bold">
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
