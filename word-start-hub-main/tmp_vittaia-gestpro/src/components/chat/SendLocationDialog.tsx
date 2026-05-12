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
import { Loader2, MapPin, Navigation } from "lucide-react";

interface SendLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
}

export const SendLocationDialog: React.FC<SendLocationDialogProps> = ({
  open,
  onOpenChange,
  chatId,
}) => {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [sending, setSending] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const { toast } = useToast();

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Não suportado",
        description: "Geolocalização não é suportada neste navegador",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString());
        setLongitude(position.coords.longitude.toString());
        setGettingLocation(false);
        toast({
          title: "Localização obtida",
          description: "Sua localização atual foi preenchida",
        });
      },
      (error) => {
        setGettingLocation(false);
        toast({
          title: "Erro",
          description: "Não foi possível obter sua localização",
          variant: "destructive",
        });
        console.error("Geolocation error:", error);
      }
    );
  };

  const handleSend = async () => {
    if (!latitude.trim() || !longitude.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha latitude e longitude",
        variant: "destructive",
      });
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: "Valores inválidos",
        description: "Latitude e longitude devem ser números válidos",
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

      const locationData = {
        latitude: lat,
        longitude: lng,
        name: name.trim() || undefined,
        address: address.trim() || undefined,
      };

      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: chatData.organization_id,
          content: JSON.stringify(locationData),
          message_type: "location",
          is_from_user: true,
          sent_by: user.id,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        }])
        .select()
        .single();

      if (messageError) throw messageError;

      // Chamar edge function para disparar webhooks
      console.log('[SendLocationDialog] Triggering sent webhooks for message:', messageData.id);
      const { error: webhookError } = await supabase.functions.invoke('trigger-sent-webhooks', {
        body: { messageId: messageData.id }
      });

      if (webhookError) {
        console.error('[SendLocationDialog] Error triggering webhooks:', webhookError);
        // Não bloquear o fluxo, a mensagem já foi salva
      }

      toast({
        title: "Localização enviada",
        description: "A localização foi enviada com sucesso",
      });

      setLatitude("");
      setLongitude("");
      setName("");
      setAddress("");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao enviar localização:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a localização",
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
            <MapPin className="h-5 w-5 text-green-500" />
            Enviar Localização
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={getCurrentLocation}
            disabled={gettingLocation}
            className="w-full"
          >
            {gettingLocation ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Obtendo...
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4 mr-2" />
                Usar minha localização
              </>
            )}
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude *</Label>
              <Input
                id="latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-23.5505"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude *</Label>
              <Input
                id="longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-46.6333"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location-name">Nome do local (opcional)</Label>
            <Input
              id="location-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Escritório"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Endereço (opcional)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex: Av. Paulista, 1000"
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
