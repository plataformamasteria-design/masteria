import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import vittaIcon from "@/assets/vitta-icon.png";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";

interface UserOrg {
  organization_id: string;
  role: string;
  is_admin: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    active: boolean;
    trial_ends_at: string | null;
  };
}

export default function SelectOrganization() {
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const navigate = useNavigate();
  const { switchOrganization } = useOrganization();
  const queryClient = useQueryClient();

  useEffect(() => {
    loadOrgs();
  }, []);

  const loadOrgs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if super_admin — they go straight to /organizations
      const { data: superRole } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (superRole) {
        navigate("/organizations");
        return;
      }

      // Fetch user's organizations
      const { data, error } = await (supabase as any)
        .from("user_organizations")
        .select("organization_id, role, is_admin, organization:organizations(id, name, slug, plan, active, trial_ends_at)")
        .eq("user_id", session.user.id);

      if (error) throw error;

      const orgs = (data || []).filter((uo: any) => uo.organization);

      if (orgs.length === 0) {
        // No orgs — check profile fallback
        navigate("/pending-authorization");
        return;
      }

      if (orgs.length === 1) {
        // Only one org — go directly
        await selectOrg(orgs[0].organization.id);
        return;
      }

      setUserOrgs(orgs);
    } catch (err) {
      console.error("Error loading orgs:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectOrg = async (orgId: string) => {
    setSelecting(orgId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Sincroniza estado React, banco de dados e local storage com o Context Provider
      await switchOrganization(orgId);

      // Limpa todo o cache de consultas para evitar vazamento de dados antigos no dashboard
      queryClient.clear();

      navigate("/dashboard");
    } catch (err) {
      console.error("Error selecting org:", err);
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-accent/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center p-1 mb-6">
            <img src={vittaIcon} alt="Vitta" className="h-10 w-auto opacity-90" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Selecione a organização
          </h1>
          <p className="text-sm text-muted-foreground">
            Você possui acesso a múltiplas organizações
          </p>
        </div>

        <div className="space-y-3">
          {userOrgs.map((uo) => {
            const org = uo.organization;
            const isTrial = !!org.trial_ends_at;
            const isInactive = !org.active;

            return (
              <button
                key={org.id}
                onClick={() => selectOrg(org.id)}
                disabled={!!selecting}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card hover:border-primary/30 hover:shadow-md transition-all duration-200 group disabled:opacity-50 text-left"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">
                    {org.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground capitalize">{org.plan}</span>
                    {isTrial && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                        Trial
                      </span>
                    )}
                    {isInactive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                        Inativa
                      </span>
                    )}
                    {uo.is_admin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {selecting === org.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
