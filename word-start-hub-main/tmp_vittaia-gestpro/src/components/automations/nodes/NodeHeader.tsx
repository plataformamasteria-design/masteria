import { useState, useRef, useEffect } from "react";
import { Copy, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NodeExecuteButton } from "./NodeOutputPanel";

interface NodeHeaderProps {
  nodeId: string;
  icon: React.ReactNode;
  defaultLabel: string;
  customLabel?: string;
  colorClass: string; // e.g. "bg-blue-500/10" for light headers or "bg-orange-500" for solid headers
  textColorClass: string; // e.g. "text-blue-500" or "text-white"
  solidHeader?: boolean; // true = white text on solid bg
  onExecute?: () => void;
  isExecuting?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onRename?: (newLabel: string) => void;
  showOnHover?: boolean; // whether action buttons show on hover (group-hover pattern)
}

export function NodeHeader({
  nodeId,
  icon,
  defaultLabel,
  customLabel,
  colorClass,
  textColorClass,
  solidHeader = false,
  onExecute,
  isExecuting,
  onDuplicate,
  onDelete,
  onRename,
  showOnHover = true,
}: NodeHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(customLabel || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const displayLabel = customLabel || defaultLabel;

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(customLabel || defaultLabel);
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    onRename?.(trimmed === defaultLabel ? "" : trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  const btnClass = solidHeader
    ? "text-white/80 hover:text-white hover:bg-white/20"
    : "text-muted-foreground";

  const actionsVisibility = showOnHover
    ? "opacity-0 group-hover:opacity-100 transition-opacity"
    : "";

  return (
    <div className={`${colorClass} px-3 py-2 flex items-center justify-between drag-handle-area cursor-grab active:cursor-grabbing`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {icon}
        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="h-5 text-xs px-1 py-0 border-none bg-white/20 text-inherit font-semibold nodrag nowheel"
            />
          </div>
        ) : (
          <span
            className={`text-xs font-semibold truncate ${textColorClass}`}
            onDoubleClick={handleStartEdit}
            title="Duplo clique para renomear"
          >
            {displayLabel}
          </span>
        )}
      </div>
      <div className={`flex items-center gap-0.5 shrink-0 ${actionsVisibility}`}>
        {!editing && onRename && (
          <Button variant="ghost" size="icon" className={`h-5 w-5 ${btnClass}`} onClick={handleStartEdit} title="Renomear">
            <Pencil className="h-2.5 w-2.5" />
          </Button>
        )}
        {onExecute && (
          <NodeExecuteButton onExecute={onExecute} isExecuting={isExecuting || false} />
        )}
        {onDuplicate && (
          <Button variant="ghost" size="icon" className={`h-5 w-5 ${btnClass}`} onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
            <Copy className="h-3 w-3" />
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" className={`h-5 w-5 ${solidHeader ? "text-white/80 hover:text-white hover:bg-white/20" : "text-destructive"}`} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
