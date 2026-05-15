"use client";

import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  actionType: "danger" | "safe";
  confirmText?: string;
  isProcessing?: boolean;
}

export function ActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  actionType,
  confirmText = "Confirmar",
  isProcessing = false
}: ActionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-zinc-950 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
              actionType === "danger" 
                ? "bg-red-500/10 border-red-500/20 text-red-500" 
                : "bg-primary/10 border-primary/20 text-primary"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 mt-1">
              <h3 className="text-lg font-bold text-foreground mb-1 leading-tight">{title}</h3>
              <p className="text-sm text-zinc-400">{description}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="bg-white/[0.02] border-t border-white/5 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center gap-2",
              actionType === "danger"
                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                : "bg-accent hover:bg-accent text-white shadow-primary/20",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
             {isProcessing ? "Executando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
