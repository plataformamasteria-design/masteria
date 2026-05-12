import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User } from "lucide-react";

interface SendContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

export const SendContactDialog: React.FC<SendContactDialogProps> = ({
  open,
  onOpenChange,
  chatId,
}) => {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!displayName.trim() || !phone.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e telefone do contato",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar organization_id e phone do chat
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("organization_id, phone")
        .eq("id", chatId)
        .single();

      if (chatError || !chatData?.organization_id) {
        throw new Error("Não foi possível buscar dados do chat");
      }

      // Criar vCard
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;${displayName};;;\nFN:${displayName}\nTEL;type=CELL;type=VOICE:${phone}\nEND:VCARD`;

      const contactData = {
        display_name: displayName.trim(),
        phone: phone.trim(),
        vcard,
      };

      // Inserir mensagem
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: chatData.organization_id,
          content: JSON.stringify(contactData),
          message_type: "contact",
          is_from_user: true,
          sent_by: user.id,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Chamar edge function para disparar webhooks
      console.log('[SendContactDialog] Triggering sent webhooks for message:', messageData.id);
      const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
        body: { messageId: messageData.id }
      });

      if (webhookError) {
        console.error('[SendContactDialog] Error triggering webhooks:', webhookError);
        // Não bloquear o fluxo, a mensagem já foi salva
      }

      toast({
        title: "Contato enviado",
        description: "O cartão de contato foi enviado com sucesso",
      });

      setDisplayName("");
      setPhone("");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao enviar contato:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o contato",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            Enviar Contato
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome do Contato</Label>
            <Input
              id="contact-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-phone">Telefone</Label>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 5511999999999"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
