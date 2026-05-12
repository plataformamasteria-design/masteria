import { Automation, Funnel, FunnelStage } from "@/pages/Automations";
import { AutomationCard } from "./AutomationCard";

interface AutomationListProps {
  automations: Automation[];
  funnels: Funnel[];
  stages: FunnelStage[];
  executionCounts: Record<string, number>;
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (automation: Automation) => void;
}

export function AutomationList({
  automations,
  funnels,
  stages,
  executionCounts,
  onEdit,
  onDelete,
  onToggleStatus,
}: AutomationListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {automations.map((automation) => (
        <AutomationCard
          key={automation.id}
          automation={automation}
          funnels={funnels}
          stages={stages}
          executionCount={executionCounts[automation.id] || 0}
          onEdit={() => onEdit(automation)}
          onDelete={() => onDelete(automation.id)}
          onToggleStatus={() => onToggleStatus(automation)}
        />
      ))}
    </div>
  );
}
