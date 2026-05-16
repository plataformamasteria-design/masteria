'use client';

import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { ContactDetailsPanel } from "@/components/atendimentos/contact-details-panel";

interface ContactProfileSheetProps {
  contactId: string | null;
  onClose: () => void;
}

export function ContactProfileSheet({ contactId, onClose }: ContactProfileSheetProps) {
  return (
    <Dialog open={!!contactId} onOpenChange={(open) => !open && onClose()}>
      {/* Overlay com blur leve e fundo mais suave */}
      <DialogOverlay className="bg-background/40 backdrop-blur-sm" />
      
      {/* Conteúdo centralizado limitando a altura para o ScrollArea interno do painel funcionar bem */}
      <DialogContent 
        className="max-w-4xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden bg-background border border-border shadow-2xl"
        // Hide standard close button from DialogContent since the ContactDetailsPanel might render its own or we rely on clicking outside
      >
        <div className="flex-1 h-full relative">
          {contactId && <ContactDetailsPanel contactId={contactId} onClose={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
