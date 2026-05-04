"use client"

import { useState } from "react";
import { Plus, Users, Settings2, Trash2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createTeam, deleteTeam, getTeams } from "@/app/actions/teams";
import { toast } from "@/hooks/use-toast";
import { TeamMembersDialog } from "./team-members-dialog";

export function TeamsPageClient({ initialTeams, allUsers }: { initialTeams: any[], allUsers: any[] }) {
    const [teams, setTeams] = useState(initialTeams);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDesc, setNewTeamDesc] = useState("");
    const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

    const refreshTeams = async () => {
        try {
            const updated = await getTeams();
            setTeams(updated);
        } catch { }
    };

    const handleCreateTeam = async () => {
        if (!newTeamName.trim()) return toast({ variant: "destructive", title: "Nome obrigatório" });
        setIsCreating(true);
        try {
            await createTeam(newTeamName, newTeamDesc);
            await refreshTeams();
            setNewTeamName("");
            setNewTeamDesc("");
            setIsCreateOpen(false); // Graceful React closure
            toast({ title: "Equipe criada com sucesso!" });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro", description: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally { setIsCreating(false); }
    }

    const handleDeleteTeam = async () => {
        if (!teamToDelete) return;

        try {
            await deleteTeam(teamToDelete);

            // Optimistic deletion
            setTeams(prev => prev.filter(t => t.id !== teamToDelete));
            setTeamToDelete(null);
            toast({ title: "Equipe removida." });
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao excluir", description: e instanceof Error ? e.message : "Erro desconhecido" });
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">{teams.length} Departamento(s)</h3>
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

            <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                variants={{
                    hidden: { opacity: 0 },
                    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
                }}
                initial="hidden"
                animate="show"
            >
                {teams.map(t => (
                    <motion.div
                        key={t.id}
                        variants={{
                            hidden: { opacity: 0, y: 15, scale: 0.98 },
                            show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
                        }}
                        className="group relative bg-white/70 backdrop-blur-xl border border-slate-200/60 hover:border-indigo-500/30 transition-all duration-300 rounded-2xl p-6 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
                    >
                        <div className="flex justify-between items-start mb-5">
                            <div className="space-y-1.5">
                                <h3 className="text-lg font-bold flex items-center gap-2.5 text-slate-800">
                                    {t.name}
                                    {!t.active && (
                                        <span className="flex items-center gap-1.5 bg-rose-50/80 backdrop-blur-md border border-rose-100 text-rose-600 text-[10px] px-2.5 py-0.5 rounded-full font-semibold tracking-wide">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                                            Inativo
                                        </span>
                                    )}
                                </h3>
                                <p className="text-[13px] text-slate-500 line-clamp-1 font-medium">{t.description || "Nenhuma descrição fornecida."}</p>
                            </div>

                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 bg-rose-50/50 hover:bg-rose-100 border border-transparent hover:border-rose-200 opacity-0 group-hover:opacity-100 transition-all rounded-lg shrink-0" onClick={() => setTeamToDelete(t.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                            <TeamMembersDialog team={t} allUsers={allUsers} />
                            <Button variant="secondary" size="sm" className="gap-1.5 text-xs h-8 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-sm border border-slate-200/50 transition-all">
                                <Settings2 className="h-3.5 w-3.5" /> Opções
                            </Button>
                        </div>
                    </motion.div>
                ))}

                {teams.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="col-span-full py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200/80 rounded-2xl bg-slate-50/50 backdrop-blur-sm"
                    >
                        <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                            <ShieldAlert className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="font-semibold text-slate-700 text-lg">Nenhum departamento</h3>
                        <p className="text-sm text-slate-500 mt-1">Crie sua primeira equipe para segmentar os atendimentos.</p>
                    </motion.div>
                )}
            </motion.div>

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
