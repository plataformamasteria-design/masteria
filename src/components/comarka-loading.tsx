import { Loader2 } from "lucide-react";

interface ComarkaLoadingProps {
  text?: string;
}

export function ComarkaLoading({ text = "Trabalhando Nisso..." }: ComarkaLoadingProps) {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center animate-in fade-in duration-300 backdrop-blur-md bg-background/80">
      <div className="relative flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground animate-pulse text-center">
           {text}
        </p>
      </div>
    </div>
  );
}
