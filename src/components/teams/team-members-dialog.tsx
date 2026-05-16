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
                <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs bg-secondary/50 hover:bg-secondary">
                    <UserPlus className="h-3.5 w-3.5 text-primary" /> {members.length > 0 ? `${members.length} Membros` : "Ver Membros"}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">Membros da equipe <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">{team.name}</span></DialogTitle>
                    <DialogDescription>Adicione ou remova atendentes deste departamento.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <Select value={selectedUser} onValueChange={setSelectedUser} disabled={isProcessing || availableUsers.length === 0}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder={availableUsers.length > 0 ? "Selecionar usuário..." : "Todos os usuários já estão no time"} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={u.avatarUrl || ""} />
                                                <AvatarFallback className="text-[10px]">{u.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{u.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAddMember} disabled={!selectedUser || isProcessing} className="gap-2">
                            {isProcessing && selectedUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} 
                            Adicionar
                        </Button>
                    </div>

                    <div className="bg-muted/30 border border-border rounded-xl p-2 min-h-[150px] max-h-[300px] overflow-y-auto space-y-2">
                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border/50 animate-pulse">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-muted" />
                                            <div className="space-y-1.5">
                                                <div className="h-3 w-24 bg-muted rounded" />
                                                <div className="h-2 w-32 bg-muted/70 rounded" />
                                            </div>
                                        </div>
                                        <div className="h-8 w-8 rounded-md bg-muted/50" />
                                    </div>
                                ))}
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <User className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
                                <span className="text-sm font-medium text-foreground">Nenhum membro</span>
                                <span className="text-xs text-muted-foreground mt-1">Este departamento está vazio. Adicione atendentes acima para rotear as conversas.</span>
                            </div>
                        ) : (
                            members.map((m: any) => (
                                <div key={m.id} className="flex items-center justify-between bg-card p-2 rounded-lg border border-border shadow-sm hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border border-border/50">
                                            <AvatarImage src={m.avatarUrl || ""} />
                                            <AvatarFallback className="text-xs font-semibold">{m.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold flex items-center gap-1.5 text-card-foreground">
                                                {m.name}
                                                {m.role === 'admin' && <Shield className="h-3 w-3 text-amber-500" />}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">{m.email}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" disabled={isProcessing} className="text-destructive h-8 w-8 hover:bg-destructive/10" onClick={() => handleRemoveMember(m.id)}>
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
