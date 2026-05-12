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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, QrCode } from "lucide-react";

interface SendPixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone" },
  { value: "EVP", label: "Chave Aleatória" },
];

export const SendPixDialog: React.FC<SendPixDialogProps> = ({
  open,
  onOpenChange,
  chatId,
}) => {
  const [pixKey, setPixKey] = useState("");
  const [keyType, setKeyType] = useState("PHONE");
  const [merchantName, setMerchantName] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!pixKey.trim() || !merchantName.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a chave PIX e o nome do beneficiário",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .select("organization_id, phone")
        .eq("id", chatId)
        .single();

      if (chatError || !chatData?.organization_id) {
        throw new Error("Não foi possível buscar dados do chat");
      }

      const pixData = {
        key: pixKey.trim(),
        key_type: keyType,
        merchant_name: merchantName.trim(),
        reference_id: referenceId.trim() || undefined,
      };

      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: chatData.organization_id,
          content: JSON.stringify(pixData),
          message_type: "pix",
          is_from_user: true,
          sent_by: user.id,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Chamar edge function para disparar webhooks
      console.log('[SendPixDialog] Triggering sent webhooks for message:', messageData.id);
      const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
        body: { messageId: messageData.id }
      });

      if (webhookError) {
        console.error('[SendPixDialog] Error triggering webhooks:', webhookError);
        // Não bloquear o fluxo, a mensagem já foi salva
      }

      toast({
        title: "PIX enviado",
        description: "Os dados de pagamento PIX foram enviados com sucesso",
      });

      setPixKey("");
      setKeyType("PHONE");
      setMerchantName("");
      setReferenceId("");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao enviar PIX:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar os dados de PIX",
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
            <QrCode className="h-5 w-5 text-teal-500" />
            Enviar Dados PIX
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="key-type">Tipo de Chave</Label>
            <Select value={keyType} onValueChange={setKeyType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {PIX_KEY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="pix-key">Chave PIX *</Label>
            <Input
              id="pix-key"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder={
                keyType === "PHONE" ? "+5511999999999" :
                keyType === "EMAIL" ? "email@exemplo.com" :
                keyType === "CPF" ? "000.000.000-00" :
                keyType === "CNPJ" ? "00.000.000/0000-00" :
                "Chave aleatória"
              }
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="merchant-name">Nome do Beneficiário *</Label>
            <Input
              id="merchant-name"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Ex: João da Silva"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="reference-id">Referência (opcional)</Label>
            <Input
              id="reference-id"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Ex: Pedido #123"
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
