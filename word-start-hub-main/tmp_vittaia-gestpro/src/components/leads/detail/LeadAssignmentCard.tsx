import { Bot, Users, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LeadAvatar } from "../LeadAvatar";
import { GroupParticipantsList } from "@/components/chat/GroupParticipantsList";
import { GroupAdminPanel } from "@/components/chat/GroupAdminPanel";

export function LeadAssignmentCard({
    chat,
    isGroup,
    canUseAIAutomation,
    isAdmin,
    handleToggleBot,
    setResolveDialogOpen
}: any) {
    return (
        <>
            {!isGroup && canUseAIAutomation && (
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center",
                            chat.agent_off ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary"
                        )}>
                            <Bot className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-medium">Status do Robô</p>
                            <p className="text-sm text-muted-foreground">
                                {chat.agent_off ? 'Desativado para este lead' : 'Ativo e respondendo'}
                            </p>
                        </div>
                    </div>
                    <Switch checked={!chat.agent_off} onCheckedChange={handleToggleBot} />
                </div>
            )}

            {isGroup && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Participantes
                    </h3>
                    <GroupParticipantsList organizationId={chat.organization_id} groupChatId={chat.id} />
                </div>
            )}

            {isGroup && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Gerenciar Grupo
                    </h3>
                    {!isAdmin ? (
                        <p className="text-sm text-muted-foreground">
                            Você pode visualizar os participantes, mas apenas administradores da plataforma podem gerenciar.
                        </p>
                    ) : null}
                    <GroupAdminPanel organizationId={chat.organization_id} groupChatId={chat.id} groupJid={chat.phone} canManage={Boolean(isAdmin)} />
                </div>
            )}

            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 flex flex-col space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Atribuição
                </h3>
                <div className="grid grid-cols-2 gap-2 flex-1">
                    <div className="p-3 rounded-lg bg-background/50 space-y-2">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Usuário</p>
                        {chat.assigned_profile ? (
                            <div className="flex flex-col items-start gap-1">
                                <LeadAvatar photoUrl={chat.assigned_profile.avatar_url} name={chat.assigned_profile.full_name} size="sm" showGroupIndicator={false} />
                                <span className="text-xs font-semibold leading-tight">{chat.assigned_profile.full_name || 'Sem nome'}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground font-medium">Não atribuído</p>
                        )}
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 space-y-2">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Equipe</p>
                        {chat.assigned_team ? (
                            <div className="flex flex-col items-start gap-1">
                                <div className="h-6 w-6 rounded flex items-center justify-center bg-primary/20">
                                    <Users className="h-3 w-3 text-primary" />
                                </div>
                                <span className="text-xs font-semibold leading-tight">{chat.assigned_team.name}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground font-medium">Não atribuído</p>
                        )}
                    </div>
                </div>

                {(chat.assigned_to || chat.team_id) && (
                    <Button onClick={() => setResolveDialogOpen(true)} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white mt-auto">
                        <CheckCircle className="h-4 w-4" />
                        Resolver Atendimento
                    </Button>
                )}
            </div>
        </>
    );
}
