"use client"

import { useState } from "react";
import { Plus, Users, Settings2, Trash2, ShieldAlert, Edit2, PauseCircle, PlayCircle, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
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
        <div className="space-y-6">
            {/* Header / Metrics */}
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-card-foreground">{teams.length} Departamento(s)</h3>
                        <p className="text-xs text-muted-foreground">Times criados na plataforma</p>
                    </div>
                </div>

                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2 shadow-lg shadow-primary/20"><Plus className="h-4 w-4" /> Criar Equipe</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Novo Departamento</DialogTitle>
                            <DialogDescription>Crie uma nova área de atendimento para separar as tratativas.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Nome da Equipe</Label>
                                <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Comercial, Suporte Avançado..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição (Opcional)</Label>
                                <Input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="Agentes de Nível 1" />
                            </div>
                            <Button onClick={handleCreateTeam} disabled={isCreating} className="w-full">
                                {isCreating ? "Criando..." : "Confirmar e Salvar"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Teams Grid */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                }}
                initial="hidden"
                animate="show"
            >
                {teams.map((t: any) => (
                    <motion.div
                        key={t.id}
                        variants={{
                            hidden: { opacity: 0, y: 15, scale: 0.98 },
                            show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
                        }}
                        className="group relative bg-card border border-border/60 hover:border-primary/30 transition-all duration-300 rounded-2xl p-6 shadow-sm hover:shadow-md"
                    >
                        <div className="flex justify-between items-start mb-5">
                            <div className="space-y-1.5 pr-6">
                                <h3 className="text-lg font-bold flex items-center gap-2.5 text-card-foreground">
                                    {t.name}
                                    {!t.active && (
                                        <span className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 text-destructive text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide">
                                            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                            Inativo
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[13px] text-muted-foreground line-clamp-1 font-medium">{t.description || "Nenhuma descrição fornecida."}</p>
                            </div>

                            {/* Options Dropdown */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 -mr-2 -mt-2">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuLabel>Opções da Equipe</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
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
                                    <DropdownMenuItem onClick={() => setTeamToDelete(t.id)} className="gap-2 text-destructive focus:text-destructive cursor-pointer">
                                        <Trash2 className="h-4 w-4" /> Excluir Departamento
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
                            <TeamMembersDialog team={t} allUsers={allUsers} />
                            
                            {/* Secondary visual indicator, completely optional now that we have Dropdown */}
                            <div className="flex -space-x-2 opacity-50 grayscale group-hover:grayscale-0 transition-all">
                                {/* Visual representation of users can go here in the future */}
                            </div>
                        </div>
                    </motion.div>
                ))}

                {teams.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-2xl bg-muted/30"
                    >
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-border">
                            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-card-foreground text-lg">Nenhum departamento</h3>
                        <p className="text-sm text-muted-foreground mt-1">Crie sua primeira equipe para segmentar os atendimentos.</p>
                    </motion.div>
                )}
            </motion.div>

            {/* Modal de Edição */}
            <Dialog open={!!teamToEdit} onOpenChange={(open) => !open && setTeamToEdit(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Departamento</DialogTitle>
                        <DialogDescription>Altere as informações da equipe.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Nome da Equipe</Label>
                            <Input value={editTeamName} onChange={e => setEditTeamName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Descrição (Opcional)</Label>
                            <Input value={editTeamDesc} onChange={e => setEditTeamDesc(e.target.value)} />
                        </div>
                        <Button onClick={handleEditTeam} disabled={isEditing} className="w-full">
                            {isEditing ? "Salvando..." : "Salvar Alterações"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de Exclusão */}
            <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação removerá a base de membros atrelados ao time (os colaboradores não serão excluídos da plataforma, apenas desvinculados do departamento).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Confirmar Exclusão
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
