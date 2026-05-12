import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Tag, Users, UsersRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface OrganizationIdsProps {
  organizationId: string;
}

interface TagItem { id: string; name: string; }
interface UserItem { id: string; full_name: string | null; email: string; }
interface TeamItem { id: string; name: string; }

function IdRow({ name, id }: { name: string; id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    toast({ title: `ID copiado!` });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-muted/50 transition-colors">
      <span className="text-xs font-medium truncate flex-1">{name}</span>
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <code className="text-[10px] bg-muted/60 px-2 py-0.5 rounded font-mono max-w-[160px] truncate text-muted-foreground">
          {id.slice(0, 8)}...
        </code>
        <Button 
          size="sm" variant="ghost" 
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-2.5 w-2.5 text-primary" /> : <Copy className="h-2.5 w-2.5" />}
        </Button>
      </div>
    </div>
  );
}

function IdGroup({ icon: Icon, label, count, children }: {
  icon: React.ElementType;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 bg-muted/20">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold flex-1">{label}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
          {count}
        </Badge>
      </div>
      <div className="p-2 max-h-52 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function OrganizationIds({ organizationId }: OrganizationIdsProps) {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) loadData();
  }, [organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tagsRes, usersRes, teamsRes] = await Promise.all([
        supabase.from('tags').select('id, name').eq('organization_id', organizationId).order('name'),
        supabase.from('profiles').select('id, full_name, email').eq('organization_id', organizationId).order('full_name'),
        supabase.from('teams').select('id, name').eq('organization_id', organizationId).order('name')
      ]);
      setTags(tagsRes.data || []);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (error) {
      console.error('Error loading organization data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-border/40 p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <IdGroup icon={Tag} label="Tags" count={tags.length}>
        {tags.length === 0 
          ? <p className="text-[11px] text-muted-foreground p-2">Nenhuma tag</p>
          : tags.map(tag => <IdRow key={tag.id} name={tag.name} id={tag.id} />)
        }
      </IdGroup>

      <IdGroup icon={Users} label="Usuários" count={users.length}>
        {users.length === 0 
          ? <p className="text-[11px] text-muted-foreground p-2">Nenhum usuário</p>
          : users.map(user => <IdRow key={user.id} name={user.full_name || user.email} id={user.id} />)
        }
      </IdGroup>

      <IdGroup icon={UsersRound} label="Equipes" count={teams.length}>
        {teams.length === 0 
          ? <p className="text-[11px] text-muted-foreground p-2">Nenhuma equipe</p>
          : teams.map(team => <IdRow key={team.id} name={team.name} id={team.id} />)
        }
      </IdGroup>
    </div>
  );
}
