import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface GhlBadgeProps {
    ghlId?: string;
    className?: string;
    showText?: boolean;
}

export function GhlBadge({ ghlId, className, showText = true }: GhlBadgeProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="outline"
                        className={cn(
                            "px-1.5 py-0 h-5 text-[10px] font-bold tracking-wider uppercase border-primary/20 bg-primary/5 text-primary gap-1",
                            className
                        )}
                    >
                        <Link2 className="h-3 w-3" />
                        {showText && <span>GHL</span>}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">Sincronizado com GoHighLevel</p>
                    {ghlId && <p className="text-[10px] text-muted-foreground font-mono mt-1">ID: {ghlId}</p>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
