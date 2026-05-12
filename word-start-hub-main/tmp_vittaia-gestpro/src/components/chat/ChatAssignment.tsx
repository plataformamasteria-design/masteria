import React, { useState } from 'react';
import { User, Users, UserX } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useChatAssignment } from '@/hooks/useChatAssignment';

interface ChatAssignmentProps {
  chatId: string;
  assignedTo?: string;
  teamId?: string;
  organizationId?: string;
  isGroup?: boolean;
}

export const ChatAssignment: React.FC<ChatAssignmentProps> = ({
  chatId,
  assignedTo,
  teamId,
  organizationId,
  isGroup = false,
}) => {
  // Groups should NEVER be assignable - render a static label instead
  if (isGroup) {
    return (
      <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 border border-border rounded-md bg-muted/50">
        <Users className="h-3.5 w-3.5" />
        <span className="font-medium">Grupo</span>
      </div>
    );
  }
  const { users, teams, currentUserId, assignToUser, assignToTeam, assignToMe, unassign } =
    useChatAssignment({ organizationId });
  
  const [open, setOpen] = useState(false);

  const assignedUser = users.find((u) => u.id === assignedTo);
  const assignedTeam = teams.find((t) => t.id === teamId);

  const handleUserSelect = async (userId: string) => {
    // Se está atribuindo a outro usuário que não seja o usuário atual, é transferência
    await assignToUser(chatId, userId);
    setOpen(false);
  };

  const handleTeamSelect = async (tId: string) => {
    await assignToTeam(chatId, tId);
    setOpen(false);
  };

  const handleUnassign = async () => {
    await unassign(chatId);
    setOpen(false);
  };

  const handleAssignToMe = async () => {
    await assignToMe(chatId);
    setOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Renderizar estado de atribuição - mostra ambos se existirem
  const renderAssignmentState = () => {
    if (assignedUser && assignedTeam) {
      // Ambos atribuídos
      return (
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarImage src={assignedUser.avatar_url} alt={assignedUser.full_name || assignedUser.email} />
            <AvatarFallback className="text-xs">
              {getInitials(assignedUser.full_name || assignedUser.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-xs">+</span>
          <Users className="h-4 w-4" />
        </div>
      );
    } else if (assignedUser) {
      // Apenas usuário
      return (
        <>
          <Avatar className="h-5 w-5">
            <AvatarImage src={assignedUser.avatar_url} alt={assignedUser.full_name || assignedUser.email} />
            <AvatarFallback className="text-xs">
              {getInitials(assignedUser.full_name || assignedUser.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline truncate max-w-[100px]">{assignedUser.full_name || assignedUser.email}</span>
        </>
      );
    } else if (assignedTeam) {
      // Apenas equipe
      return (
        <>
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline truncate max-w-[100px]">{assignedTeam.name}</span>
        </>
      );
    } else {
      // Nenhuma atribuição
      return (
        <>
          <UserX className="h-4 w-4" />
          <span className="hidden sm:inline">Não atribuído</span>
        </>
      );
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {renderAssignmentState()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto bg-popover">
        <DropdownMenuLabel>Atribuir conversa</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Info atual */}
        {(assignedUser || assignedTeam) && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {assignedUser && (
                <div className="flex items-center gap-1.5 mb-1">
                  <User className="h-3 w-3" />
                  <span>Agente: {assignedUser.full_name || assignedUser.email}</span>
                </div>
              )}
              {assignedTeam && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  <span>Equipe: {assignedTeam.name}</span>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={handleAssignToMe}>
          <User className="mr-2 h-4 w-4" />
          Atribuir para mim
        </DropdownMenuItem>

        {(assignedTo || teamId) && (
          <DropdownMenuItem onClick={handleUnassign}>
            <UserX className="mr-2 h-4 w-4" />
            Remover todas atribuições
          </DropdownMenuItem>
        )}

        {users.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Agentes
            </DropdownMenuLabel>
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => handleUserSelect(user.id)}
                className={user.id === assignedTo ? 'bg-primary/10' : ''}
              >
                <Avatar className="mr-2 h-5 w-5">
                  <AvatarImage src={user.avatar_url} alt={user.full_name || user.email} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.full_name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{user.full_name || user.email}</span>
                {user.id === assignedTo && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {teams.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Equipes
            </DropdownMenuLabel>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.id}
                onClick={() => handleTeamSelect(team.id)}
                className={team.id === teamId ? 'bg-primary/10' : ''}
              >
                <Users className="mr-2 h-4 w-4" />
                <span className="truncate">{team.name}</span>
                {team.id === teamId && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
