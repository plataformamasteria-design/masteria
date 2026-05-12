import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Loader2, Crown, FileText, Zap } from "lucide-react";
import { useAiReplySuggestion } from "@/hooks/useAiReplySuggestion";
import { cn } from "@/lib/utils";

interface AiReplySuggestionButtonProps {
  chatId: string;
  onSuggestion: (text: string) => void;
  disabled?: boolean;
}

/**
 * Always shows a prompt picker popover when clicked.
 * The user selects which prompt to use — the generated text
 * is placed in the message input WITHOUT being sent.
 */
export const AiReplySuggestionButton: React.FC<AiReplySuggestionButtonProps> = ({
  chatId,
  onSuggestion,
  disabled = false,
}) => {
  const { generate, isGenerating, prompts, loadingPrompts, loadPrompts } =
    useAiReplySuggestion();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // Load prompts on mount so they're ready when user opens popover
  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  // Also reload every time the popover opens (handles org-context timing issues)
  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) {
      loadPrompts();
    }
  };

  const handleGenerate = async (promptId: string) => {
    setPopoverOpen(false);
    setGeneratingId(promptId);
    try {
      const result = await generate(chatId, promptId);
      if (result) {
        onSuggestion(result);
      }
    } finally {
      setGeneratingId(null);
    }
  };

  /* ── Loading spinner while generating ── */
  if (isGenerating) {
    return (
      <div className="shrink-0 h-8 w-8 flex items-center justify-center">
        <div className="relative">
          <Sparkles className="h-4 w-4 text-violet-500 opacity-40" />
          <Loader2 className="absolute inset-0 h-4 w-4 text-violet-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || loadingPrompts}
                className={cn(
                  "shrink-0 h-8 w-8 transition-all duration-200",
                  "text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10",
                  "hover:scale-110 active:scale-95",
                  popoverOpen && "text-violet-500 bg-violet-500/10"
                )}
              >
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
            Gerar resposta com I.A
            <br />
            <span className="text-muted-foreground/70">escolha o prompt e revise antes de enviar</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-72 p-0 overflow-hidden shadow-xl border-border/60"
      >
        {/* Header */}
        <div className="px-3 pt-3 pb-2 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-violet-500/15 rounded-md">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Gerar resposta com I.A</p>
              <p className="text-[10px] text-muted-foreground">Escolha o prompt para geração</p>
            </div>
          </div>
        </div>

        {/* Prompt list */}
        <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
          {loadingPrompts ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Carregando prompts...</span>
            </div>
          ) : prompts.length === 0 ? (
            <div className="px-3 py-5 text-center space-y-2">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center mx-auto">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Nenhum prompt configurado.
                <br />
                Vá em{" "}
                <span className="font-medium text-foreground">Automações → I.A</span>{" "}
                para criar um.
              </p>
            </div>
          ) : (
            prompts.map((p: any) => {
              const isHead = p.isHead;
              const isThisGenerating = generatingId === p.id;

              return (
                <button
                  key={p.id}
                  onClick={() => handleGenerate(p.id)}
                  disabled={isGenerating}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md",
                    "flex items-center gap-3 group",
                    "transition-all duration-150",
                    "hover:bg-violet-500/10",
                    isThisGenerating && "bg-violet-500/10"
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                      isHead
                        ? "bg-amber-500/15 group-hover:bg-amber-500/25"
                        : "bg-muted group-hover:bg-violet-500/15"
                    )}
                  >
                    {isThisGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 text-violet-500 animate-spin" />
                    ) : isHead ? (
                      <Crown className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                    )}
                  </div>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          "group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors"
                        )}
                      >
                        {p.name}
                      </span>
                      {isHead && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Head
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.fieldCount} campo{p.fieldCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Arrow indicator */}
                  <div
                    className={cn(
                      "shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full transition-all",
                      "opacity-0 group-hover:opacity-100",
                      "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                    )}
                  >
                    Usar
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        {prompts.length > 0 && (
          <div className="px-3 py-2 border-t border-border/50 bg-muted/20">
            <p className="text-[10px] text-muted-foreground text-center">
              A resposta gerada preenche o campo de texto — você revisa antes de enviar
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
