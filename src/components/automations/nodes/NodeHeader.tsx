import { useState, useRef, useEffect, isValidElement } from "react";
import { Copy, Trash2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NodeExecuteButton } from "./NodeOutputPanel";

interface NodeHeaderProps {
  nodeId?: string;
  icon?: any;
  defaultLabel?: string;
  customLabel?: string;
  label?: string; // fallback para os nós antigos
  category?: string; // fallback
  selected?: boolean; // fallback
  color?: { bg: string; text: string }; // fallback para os nós antigos
  colorClass?: string;
  textColorClass?: string;
  solidHeader?: boolean;
  onExecute?: () => void;
  isExecuting?: boolean;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onRename?: (newLabel: string) => void;
  onLabelChange?: (newLabel: string) => void; // fallback
  showOnHover?: boolean;
}

export function NodeHeader({
  nodeId,
  icon,
  defaultLabel,
  customLabel,
  label,
  category,
  selected,
  color,
  colorClass,
  textColorClass,
  solidHeader = false,
  onExecute,
  isExecuting,
  onDuplicate,
  onDelete,
  onRename,
  onLabelChange,
  showOnHover = true,
}: NodeHeaderProps) {
  const [editing, setEditing] = useState(false);

  const finalDefaultLabel = defaultLabel || label || category || "No Name";
  const displayLabel = customLabel || label || defaultLabel || "";

  const [editValue, setEditValue] = useState(customLabel || label || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(customLabel || label || defaultLabel || "");
    setEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    const finalName = trimmed === finalDefaultLabel ? "" : trimmed;
    if (onRename) onRename(finalName);
    if (onLabelChange) onLabelChange(finalName);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  };

  const finalBgClass = color?.bg || colorClass || "bg-slate-100";
  const finalTxtClass = color?.text || textColorClass || "text-slate-900";
  const btnClass = solidHeader || color?.bg
    ? "text-white/80 hover:text-white hover:bg-white/20"
    : "text-muted-foreground";

  const actionsVisibility = showOnHover
    ? "opacity-0 group-hover:opacity-100 transition-opacity"
    : "";

  let RenderedIcon = null;
  if (isValidElement(icon)) {
    RenderedIcon = icon;
  } else if (icon) {
    const IconComp = icon as any;
    RenderedIcon = <IconComp className="h-4 w-4 text-inherit" />;
  }

  // Support legacy styles wrapping
  const containerClass = color
    ? "flex items-center gap-2 mb-3" // Modern nodes minimal style
    : `${finalBgClass} px-3 py-2 flex items-center justify-between drag-handle-area cursor-grab active:cursor-grabbing`; // Legacy full header style

  return (
    <div className={containerClass}>
      <div className={`flex items-center gap-2 min-w-0 flex-1 ${color ? 'p-1' : ''}`}>
        <div className={`flex items-center justify-center transition-transform group-hover:scale-105 ${color ? `w-10 h-10 rounded-xl ${finalBgClass} ${finalTxtClass} shadow-inner ring-1 ring-white/40` : ''}`}>
          {RenderedIcon}
        </div>

        {color && (
          <div className="flex flex-col ml-1">
            {category && <span className="text-[9px] font-black text-zinc-400/80 uppercase tracking-[0.2em]">{category}</span>}
            <span className={`text-[13px] font-bold text-zinc-800 tracking-tight truncate leading-tight`} onDoubleClick={handleStartEdit} title="Duplo clique para renomear">
              {displayLabel}
            </span>
          </div>
        )}

        {!color && (
          editing ? (
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
              className={`text-xs font-semibold truncate ${finalTxtClass}`}
              onDoubleClick={handleStartEdit}
              title="Duplo clique para renomear"
            >
              {displayLabel}
            </span>
          )
        )}
      </div>

      {color && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Legacy actions panel for solid headers */}
      {!color && (
        <div className={`flex items-center gap-0.5 shrink-0 ${actionsVisibility}`}>
          {!editing && (onRename || onLabelChange) && (
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
      )}
    </div>
  );
}
