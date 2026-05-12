import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MessageSquare, Trash2, Users } from "lucide-react";
import { LeadAvatar } from "../LeadAvatar";
import { LeadNameEditor } from "../LeadNameEditor";
import { LeadPhoneEditor } from "../LeadPhoneEditor";
import { LeadQualityBadge } from "../LeadQualityBadge";
import { cn } from "@/lib/utils";

export function LeadDetailHeader({
    chat,
    chatId,
    isGroup,
    displayName,
    photoUrl,
    primaryFunnelTag,
    onGoToChat,
    onClearHistory,
    onDeleteLead,
    onChatDetailsRefresh
}: any) {
    return (
        <div className={cn(
            "relative overflow-hidden p-6 pb-8 shrink-0",
            "bg-gradient-to-br",
            isGroup
                ? "from-green-500/20 via-emerald-500/10 to-background"
                : "from-primary/20 via-primary/10 to-background"
        )}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0aC0ydi00aDJ2NHptMC02aC0ydi00aDJ2NHptLTYgNmgtMnYtNGgydjR6bTAtNmgtMnYtNGgydjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

            <div className="relative flex items-start gap-4">
                <LeadAvatar
                    isGroup={isGroup}
                    photoUrl={photoUrl}
                    name={displayName}
                    participantCount={chat.participant_count}
                    size="xl"
                />

                <div className="flex-1 min-w-0 space-y-2">
                    {isGroup ? (
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-green-500 shrink-0" />
                            <h2 className="text-2xl font-bold text-foreground truncate">
                                {displayName}
                            </h2>
                        </div>
                    ) : (
                        <LeadNameEditor
                            chatId={chat.id}
                            customName={chat.custom_name || null}
                            waName={chat.wa_name}
                            phone={chat.phone}
                            nameLocked={chat.name_locked || false}
                            onNameUpdated={onChatDetailsRefresh}
                            size="lg"
                        />
                    )}

                    {!isGroup && (
                        <LeadPhoneEditor
                            chatId={chat.id}
                            phone={chat.phone}
                            onPhoneUpdated={onChatDetailsRefresh}
                            size="lg"
                        />
                    )}

                    {isGroup && chat.participant_count && (
                        <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            <Users className="h-3 w-3 mr-1" />
                            {chat.participant_count} participantes
                        </Badge>
                    )}

                    {primaryFunnelTag && (
                        <Badge
                            style={{ backgroundColor: primaryFunnelTag.color }}
                            className="text-white shadow-md"
                        >
                            📍 {primaryFunnelTag.name}
                        </Badge>
                    )}

                    <LeadQualityBadge chatId={chatId} />
                </div>

                <Button onClick={onGoToChat} className="shrink-0 gap-2 shadow-lg">
                    <MessageSquare className="h-4 w-4" />
                    Ir para Conversa
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    onClick={onClearHistory}
                    title="Limpar Histórico"
                >
                    <History className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={onDeleteLead}
                    title="Excluir Lead"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {isGroup && chat.group_description && (
                <p className="mt-4 text-sm text-muted-foreground bg-background/50 rounded-lg p-3 backdrop-blur-sm">
                    {chat.group_description}
                </p>
            )}
        </div>
    );
}
