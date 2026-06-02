import { useState } from "react";
import { UserPlus, UserMinus, Shield, User, Loader2 } from "lucide-react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTeamMembers, addMemberToTeam, removeMemberFromTeam } from "@/app/actions/teams";
import { toast } from "@/hooks/use-toast";

export function TeamMembersDialog({ team, allUsers }: { team: any, allUsers: any[] }) {
    const [open, setOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string>("");

    // SWR fetcher para garantir dados em tempo real quando o dialog está aberto
    const { data: members = [], isLoading, mutate } = useSWR(
        open ? `team-members-${team.id}` : null, 
        async () => await getTeamMembers(team.id)
    );

    const onOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSelectedUser("");
        }
    };

    const handleAddMember = async () => {
        if (!selectedUser) return;
        setIsProcessing(true);
        try {
            await addMemberToTeam(team.id, selectedUser);
            toast({ title: "Membro adicionado" });
            await mutate(); // Revalida a lista
            setSelectedUser("");
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao adicionar", description: e instanceof Error ? e.message : "Erro desconhecido" });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        setIsProcessing(true);
        try {
            // Optimistic update
            mutate(members.filter((m: any) => m.id !== userId), false);
            await removeMemberFromTeam(team.id, userId);
            toast({ title: "Membro removido" });
            await mutate();
        } catch (e: unknown) {
            toast({ variant: "destructive", title: "Erro ao remover", description: e instanceof Error ? e.message : "Erro desconhecido" });
            mutate(); // Revert
        } finally {
            setIsProcessing(false);
        }
    };

    const availableUsers = allUsers.filter(u => !members.some((m: any) => m.id === u.id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg">
                    <UserPlus className="h-3.5 w-3.5 text-emerald-400" /> {members.length > 0 ? `${members.length} Membros` : "Ver Membros"}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-zinc-950/90 backdrop-blur-3xl border-white/10 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">Membros da equipe <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium">{team.name}</span></DialogTitle>
                    <DialogDescription className="text-zinc-400">Adicione ou remova atendentes deste departamento.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isProcessing || availableUsers.length === 0}>
                            <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white focus:ring-emerald-500/50 rounded-xl h-10">
                                <SelectValue placeholder={availableUsers.length > 0 ? "Selecionar usuário..." : "Todos os usuários já estão no time"} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10 text-zinc-200">
                                {availableUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id} className="focus:bg-white/10 focus:text-white cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={u.avatarUrl || ""} />
                                                <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300">{u.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{u.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAddMember} disabled={!selectedUser || isProcessing} className="gap-2 h-10 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 font-bold px-4">
                            {isProcessing && selectedUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} 
                            Adicionar
                        </Button>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-2 min-h-[150px] max-h-[300px] overflow-y-auto space-y-2 custom-scrollbar shadow-[inset_0_1px_10px_rgba(0,0,0,0.5)]">
                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center justify-between bg-white/[0.02] p-2 rounded-xl border border-white/5 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-white/10" />
                                            <div className="space-y-1.5">
                                                <div className="h-3 w-24 bg-white/10 rounded" />
                                                <div className="h-2 w-32 bg-white/5 rounded" />
                                            </div>
                                        </div>
                                        <div className="h-8 w-8 rounded-lg bg-white/5" />
                                    </div>
                                ))}
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <User className="h-8 w-8 text-zinc-600 mb-2 opacity-50" />
                                <span className="text-sm font-medium text-white">Nenhum membro</span>
                                <span className="text-xs text-zinc-400 mt-1">Este departamento está vazio. Adicione atendentes acima para rotear as conversas.</span>
                            </div>
                        ) : (
                            members.map((m: any) => (
                                <div key={m.id} className="flex items-center justify-between bg-white/[0.02] p-2 rounded-xl border border-white/5 shadow-sm hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all group">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-white/10">
                                            <AvatarImage src={m.avatarUrl || ""} />
                                            <AvatarFallback className="text-xs font-semibold bg-zinc-800 text-zinc-300">{m.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold flex items-center gap-1.5 text-white">
                                                {m.name}
                                                {m.role === 'admin' && <Shield className="h-3 w-3 text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" />}
                                            </p>
                                            <p className="text-[10px] text-zinc-400">{m.email}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" disabled={isProcessing} className="text-red-400 h-8 w-8 hover:bg-red-500/20 hover:text-red-300 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" onClick={() => handleRemoveMember(m.id)}>
                                        <UserMinus className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
