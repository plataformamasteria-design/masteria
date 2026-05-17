import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Braces, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CustomField {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  is_system: boolean;
}

interface VariablePickerProps {
  onInsert: (variable: string) => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

/**
 * VariablePicker: Shows available custom fields as insertable variables.
 * When a variable is selected, it calls onInsert with the variable placeholder
 * in the format {{field_key}} so it can be inserted into a text area.
 */
export function VariablePicker({ onInsert, compact = false }: VariablePickerProps) {
  const { currentOrganization } = useOrganization();
  const [fields, setFields] = useState<CustomField[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    (async () => {
      try {
        if (typeof (supabase as any).rpc === 'function') {
          await (supabase as any).rpc('ensure_system_custom_fields', { org_id: currentOrganization.id });
        }
        const { data } = await (supabase as any)
          .from('chat_custom_fields')
          .select('id, field_key, field_label, field_type, is_system')
          .eq('organization_id', currentOrganization.id)
          .order('order_position');
        if (data) setFields(data);
      } catch (err) {
        console.error("Failed to load variables:", err);
      }
    })();
  }, [currentOrganization?.id]);

  const filtered = fields.filter(f =>
    f.field_label.toLowerCase().includes(search.toLowerCase()) ||
    f.field_key.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (field: CustomField) => {
    onInsert(`{{${field.field_key}}}`);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title="Inserir campo personalizado"
            type="button"
          >
            <Braces className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            type="button"
          >
            <Braces className="h-3.5 w-3.5" />
            Campos
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" side="top">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campo..."
              className="h-8 text-xs pl-7"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[240px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum campo encontrado</p>
            ) : (
              filtered.map((field) => (
                <button
                  key={field.id}
                  onClick={() => handleSelect(field)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-muted transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono px-1.5 py-0 shrink-0 bg-violet-500/10 text-violet-600 border-violet-500/20"
                  >
                    {`{{${field.field_key}}}`}
                  </Badge>
                  <span className="text-xs text-foreground truncate">{field.field_label}</span>
                  {field.is_system && (
                    <span className="text-[9px] text-muted-foreground ml-auto shrink-0">sistema</span>
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
