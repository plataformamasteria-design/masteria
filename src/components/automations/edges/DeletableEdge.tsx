import { memo } from "react";
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";

function DeletableEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDelete = (data as any)?.onDeleteEdge;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan group/edge"
        >
          {label && (
            <span className="text-[10px] text-muted-foreground bg-card/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border shadow-sm">
              {label}
            </span>
          )}
          <button
            className={`absolute -top-4 left-1/2 -translate-x-1/2 transition-all duration-200 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg hover:scale-110 active:scale-95 ${selected || "group-hover/edge:opacity-100 opacity-0"
              }`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(id);
            }}
            title="Remover conexão"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const DeletableEdge = memo(DeletableEdgeComponent);
