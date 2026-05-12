import { useState, useEffect, useCallback } from "react";
import { Search, User, Phone, X, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface TestLead {
  id: string;
  phone: string;
  name: string;
}

interface TestLeadSelectorProps {
  value: TestLead | null;
  onChange: (lead: TestLead | null) => void;
}

export function TestLeadSelector({ value, onChange }: TestLeadSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<TestLead[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useOrganization();

  const searchLeads = useCallback(async (q: string) => {
    if (!currentOrganization?.id || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("chats")
        .select("id, phone, custom_name, wa_name")
        .eq("organization_id", currentOrganization.id)
        .eq("is_group", false)
        .or(`phone.ilike.%${q}%,custom_name.ilike.%${q}%,wa_name.ilike.%${q}%`)
        .limit(8);

      setResults(
        (data || []).map((c: any) => ({
          id: c.id,
          phone: c.phone,
          name: c.custom_name || c.wa_name || c.phone,
        }))
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    const timer = setTimeout(() => searchLeads(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchLeads]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-1.5">
        <User className="h-3 w-3 text-emerald-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium truncate">{value.name}</p>
          <p className="text-[9px] text-muted-foreground font-mono">{value.phone}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0"
          onClick={() => onChange(null)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        className="w-full flex items-center gap-2 text-left rounded-lg border border-dashed border-border px-2 py-1.5 hover:bg-accent/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground">Selecionar lead para teste...</span>
      </button>

      {open && (
        <div className="rounded-lg border border-border bg-card shadow-md overflow-hidden">
          <div className="p-1.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Buscar por nome ou telefone..."
              className="h-7 text-[11px]"
              autoFocus
            />
          </div>
          <div className="max-h-[160px] overflow-y-auto">
            {loading && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Buscando...</p>
            )}
            {!loading && search.length < 2 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Digite ao menos 2 caracteres</p>
            )}
            {!loading && search.length >= 2 && results.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
            )}
            {results.map((lead) => (
              <button
                key={lead.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 text-left transition-colors"
                onClick={() => {
                  onChange(lead);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate">{lead.name}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">{lead.phone}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
