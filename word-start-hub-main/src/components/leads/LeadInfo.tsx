import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Users, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadInfoProps {
  isGroup?: boolean;
  name?: string | null;
  phone: string;
  groupName?: string | null;
  participantCount?: number | null;
  groupDescription?: string | null;
  customName?: string | null;
  variant?: 'compact' | 'normal' | 'expanded';
  className?: string;
}

export const LeadInfo: React.FC<LeadInfoProps> = ({
  isGroup = false,
  name,
  phone,
  groupName,
  participantCount,
  groupDescription,
  customName,
  variant = 'normal',
  className,
}) => {
  // Custom name takes priority over wa_name for non-groups
  const displayName = isGroup ? (groupName || phone) : (customName || name || 'Sem nome');

  if (variant === 'compact') {
    return (
      <div className={cn("min-w-0", className)}>
        <div className="flex items-center gap-1.5">
          {isGroup && <Users className="h-3 w-3 text-green-500 shrink-0" />}
          <span className="font-medium text-foreground truncate text-sm">
            {displayName}
          </span>
        </div>
        {!isGroup && <p className="text-xs text-muted-foreground truncate">{phone}</p>}
      </div>
    );
  }

  if (variant === 'expanded') {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          {isGroup && <Users className="h-4 w-4 text-green-500 shrink-0" />}
          <h3 className="text-xl font-bold text-foreground truncate">
            {displayName}
          </h3>
          {isGroup && (
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 shrink-0">
              <Users className="h-3 w-3 mr-1" />
              {participantCount || 0} participantes
            </Badge>
          )}
        </div>
        
        {!isGroup && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{phone}</span>
          </div>
        )}

        {isGroup && groupDescription && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {groupDescription}
          </p>
        )}
      </div>
    );
  }

  // Normal variant
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div className="flex items-center gap-2">
        {isGroup && <Users className="h-3.5 w-3.5 text-green-500 shrink-0" />}
        <h3 className="font-semibold text-foreground truncate">
          {displayName}
        </h3>
      </div>
      
      {!isGroup && <p className="text-xs text-muted-foreground">{phone}</p>}
      
      {isGroup && (
        <Badge 
          variant="secondary" 
          className="bg-green-500/10 text-green-600 border-green-500/20 text-xs gap-1"
        >
          <Users className="h-3 w-3" />
          {participantCount || 0} participantes
        </Badge>
      )}
    </div>
  );
};