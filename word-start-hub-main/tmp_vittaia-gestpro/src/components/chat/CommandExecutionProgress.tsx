import React from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CommandExecutionProgressProps {
  commandName: string;
  currentStep: number;
  totalSteps: number;
  onCancel: () => void;
}

export function CommandExecutionProgress({
  commandName,
  currentStep,
  totalSteps,
  onCancel,
}: CommandExecutionProgressProps) {
  const progress = (currentStep / totalSteps) * 100;
  const isComplete = currentStep >= totalSteps;

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors',
      isComplete 
        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
        : 'bg-primary/5 border-primary/20'
    )}>
      {isComplete ? (
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={cn(
            'text-sm font-medium truncate',
            isComplete ? 'text-green-700 dark:text-green-300' : 'text-foreground'
          )}>
            {isComplete ? 'Concluído:' : 'Enviando:'} {commandName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {currentStep}/{totalSteps}
          </span>
        </div>
        <Progress 
          value={progress} 
          className={cn(
            'h-1.5',
            isComplete && '[&>div]:bg-green-500'
          )}
        />
      </div>

      {!isComplete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={onCancel}
          title="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
