import React from 'react';
import { Pencil, Trash2, Users, MoreVertical, Shield, ShieldOff, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TeamMember {
  profile: {
    id: string;
    full_name?: string | null;
    email: string;
    avatar_url?: string | null;
  };
}

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    active: boolean;
    members?: TeamMember[];
  };
  onManageMembers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  onManageMembers,
  onEdit,
  onDelete,
}) => {
  const teamColor = team.color || '#10b981';
  const memberCount = team.members?.length || 0;
  const displayMembers = team.members?.slice(0, 6) || [];
  const extraMembers = memberCount - 6;

  const getInitials = (name?: string | null, email?: string) => {
    const displayName = name || email || '?';
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/50",
        "bg-gradient-to-br from-card to-card/80",
        "hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
        "transition-all duration-300 hover:-translate-y-1",
        "animate-scale-in"
      )}
    >
      {/* Glow effect on hover */}
      <div 
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
        style={{ backgroundColor: teamColor + '30' }}
      />
      
      {/* Header with team color */}
      <div 
        className="relative h-20"
        style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}cc)` }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZoLTJ2LTRoMnY0em0tNiA2aC0ydi00aDJ2NHptMC02aC0ydi00aDJ2NHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          {team.active ? (
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm gap-1">
              <Shield className="h-3 w-3" />
              Ativa
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-black/20 text-white border-white/20 backdrop-blur-sm gap-1">
              <ShieldOff className="h-3 w-3" />
              Inativa
            </Badge>
          )}
        </div>

        {/* Actions Menu */}
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 bg-white/20 hover:bg-white/30 text-white">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Team Avatar */}
        <div className="absolute -bottom-8 left-6">
          <div 
            className="h-16 w-16 rounded-2xl shadow-lg flex items-center justify-center text-white font-bold text-xl ring-4 ring-background"
            style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}dd)` }}
          >
            {team.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-12 pb-5 px-6">
        {/* Team Info */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-foreground truncate">
              {team.name}
            </h3>
            <div 
              className="h-3 w-3 rounded-full ring-1 ring-border shrink-0" 
              style={{ backgroundColor: teamColor }}
              title="Cor da equipe"
            />
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {team.description || 'Sem descrição'}
          </p>
        </div>

        {/* Members Preview - Grid of avatars */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Membros
            </span>
            <Badge variant="secondary" className="text-xs">
              {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            {displayMembers.length > 0 ? (
              <div className="flex -space-x-2">
                {displayMembers.map((member, index) => (
                  <Avatar
                    key={member.profile.id}
                    className={cn(
                      "h-10 w-10 ring-2 ring-background",
                      "transition-transform hover:scale-110 hover:z-10"
                    )}
                    style={{ zIndex: displayMembers.length - index }}
                    title={member.profile.full_name || member.profile.email}
                  >
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback 
                      className="text-xs font-medium"
                      style={{ backgroundColor: teamColor + '20', color: teamColor }}
                    >
                      {getInitials(member.profile.full_name, member.profile.email)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {extraMembers > 0 && (
                  <div 
                    className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-background"
                    style={{ backgroundColor: teamColor + '20', color: teamColor }}
                  >
                    +{extraMembers}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">Nenhum membro</span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onManageMembers}
              className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
            >
              <Users className="h-4 w-4" />
              Gerenciar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
