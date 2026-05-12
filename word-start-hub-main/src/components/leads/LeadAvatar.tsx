import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadAvatarProps {
  isGroup?: boolean;
  photoUrl?: string | null;
  name?: string | null;
  participantCount?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showGroupIndicator?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

const iconSizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-7 w-7',
};

const textSizes = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-lg',
};

export const LeadAvatar: React.FC<LeadAvatarProps> = ({
  isGroup = false,
  photoUrl,
  name,
  participantCount,
  size = 'md',
  showGroupIndicator = true,
  className,
}) => {
  const getInitial = () => {
    if (name && name.length > 0) {
      return name.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <div className={cn("relative", className)}>
      <Avatar className={cn(
        sizeClasses[size],
        "ring-1 shadow-sm transition-transform",
        isGroup 
          ? "ring-green-500/30 bg-gradient-to-br from-green-500/20 to-emerald-500/20" 
          : "ring-primary/30 bg-gradient-to-br from-primary/20 to-blue-500/20"
      )}>
        <AvatarImage src={photoUrl || undefined} className="object-cover" />
        <AvatarFallback className={cn(
          "font-semibold",
          textSizes[size],
          isGroup 
            ? "bg-gradient-to-br from-green-500/30 to-emerald-500/30 text-green-700 dark:text-green-400" 
            : "bg-gradient-to-br from-primary/30 to-blue-500/30 text-primary"
        )}>
          {isGroup ? (
            <Users className={cn(iconSizes[size], "text-green-600 dark:text-green-400")} />
          ) : photoUrl ? (
            getInitial()
          ) : (
            <User className={cn(iconSizes[size], "text-primary")} />
          )}
        </AvatarFallback>
      </Avatar>

      {/* Group Indicator Badge */}
      {isGroup && showGroupIndicator && (
        <div className={cn(
          "absolute -bottom-1 -right-1 rounded-full bg-green-500 text-white",
          "flex items-center justify-center shadow-lg ring-2 ring-background",
          size === 'sm' && "h-4 w-4",
          size === 'md' && "h-5 w-5",
          size === 'lg' && "h-6 w-6",
          size === 'xl' && "h-7 w-7"
        )}>
          <Users className={cn(
            size === 'sm' && "h-2.5 w-2.5",
            size === 'md' && "h-3 w-3",
            size === 'lg' && "h-3.5 w-3.5",
            size === 'xl' && "h-4 w-4"
          )} />
        </div>
      )}
    </div>
  );
};