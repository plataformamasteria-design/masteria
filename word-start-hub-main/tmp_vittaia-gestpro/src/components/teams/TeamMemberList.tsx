import React, { useState, useEffect } from 'react';
import { UserPlus, X, Mail, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Profile } from '@/types/database-helpers';
import { supabase } from '@/lib/supabase-client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface TeamMemberListProps {
  teamId: string;
  members: (Profile & { team_member_id?: string })[];
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}

export const TeamMemberList: React.FC<TeamMemberListProps> = ({
  teamId,
  members,
  onAddMember,
  onRemoveMember,
}) => {
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAvailableUsers();
    }
  }, [members, currentOrganization?.id]);

  const fetchAvailableUsers = async () => {
    if (!currentOrganization?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('full_name');

      if (error) throw error;

      const memberIds = members.map((m) => m.id);
      const available = (data || []).filter((u) => !memberIds.includes(u.id));
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error fetching available users:', error);
    }
  };

  const getInitials = (name?: string | null, email?: string) => {
    const displayName = name || email || '?';
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAddMember = () => {
    if (selectedUserId) {
      onAddMember(selectedUserId);
      setSelectedUserId('');
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      member.full_name?.toLowerCase().includes(search) ||
      member.email.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
      {/* Add Member Section */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-5 w-5 text-primary" />
          <span className="font-medium">Adicionar Membro</span>
        </div>
        <div className="flex gap-2">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="flex-1 h-11 bg-background">
              <SelectValue placeholder="Selecionar usuário..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhum usuário disponível
                </div>
              ) : (
                availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.full_name || user.email}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAddMember} disabled={!selectedUserId} className="h-11 px-6">
            Adicionar
          </Button>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-foreground">
            Membros ({members.length})
          </span>
          {members.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48 h-9"
              />
            </div>
          )}
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">Nenhum membro nesta equipe</p>
            <p className="text-sm text-muted-foreground">
              Adicione membros usando o seletor acima
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2 pr-4">
              {filteredMembers.map((member, index) => (
                <div
                  key={member.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl",
                    "bg-gradient-to-r from-card to-card/80",
                    "border border-border/50 hover:border-primary/30",
                    "transition-all duration-200 hover:shadow-md",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/30 text-primary font-semibold">
                        {getInitials(member.full_name, member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">
                        {member.full_name || 'Sem nome'}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{member.email}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => onRemoveMember(member.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};