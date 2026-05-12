import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NewContactDialogProps {
  onChatCreated: (chatId: string) => void;
  onRefresh: () => void;
}

export const NewContactDialog: React.FC<NewContactDialogProps> = ({ onChatCreated, onRefresh }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [mensagem, setMensagem] = useState("");
  const { currentOrganization } = useOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de organização primeiro
    if (!currentOrganization?.id) {
      console.error('[NewContactDialog] Nenhuma organização selecionada no contexto');
      toast({
        title: "Erro",
        description: "Selecione uma organização antes de enviar mensagens",
        variant: "destructive",
      });
      return;
    }

    // Validação de número
    const numeroLimpo = numero.replace(/\D/g, "");
    if (numeroLimpo.length < 10) {
      toast({
        title: "Erro",
        description: "Número de telefone inválido. Mínimo 10 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (!mensagem.trim()) {
      toast({
        title: "Erro",
        description: "A mensagem não pode estar vazia.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar dados do agente logado
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('[NewContactDialog] Usuário não autenticado');
        toast({
          title: "Erro",
          description: "Você precisa estar logado para enviar mensagens",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('[NewContactDialog] Usuário logado:', user.id, user.email);
      
      let agentName = "Agente";
      // NOTE: cast to any to avoid TS mismatch while generated DB types propagate.
      const { data: profile } = await (supabase.from('profiles') as any)
        .select('full_name, message_signature_enabled')
        .eq('id', user.id)
        .single();
      
      if (profile?.full_name) {
        agentName = profile.full_name;
        console.log('[NewContactDialog] Nome do agente:', agentName);
      }

      const signatureEnabled = profile?.message_signature_enabled ?? true;

      const organizationId = currentOrganization!.id;
      console.log('[NewContactDialog] Organization ID:', organizationId);

      // Validar número no WhatsApp antes de criar contato
      let canonicalNumber = numeroLimpo;
      let profilePictureUrl: string | null = null;
      let profileName: string | null = null;

      try {
        const { data: validateData, error: validateError } = await supabase.functions.invoke('evolution-api', {
          body: { action: 'validate-number', organization_id: organizationId, numbers: [numeroLimpo] },
        });
        const validateResult = { ok: !validateError, json: async () => validateData, data: validateData };

        if (validateResult.ok) {
          const data = await validateResult.json();
          if (data.results && data.results.length > 0) {
            const result = data.results[0];
            if (!result.exists) {
              toast({
                title: "Número inválido",
                description: "Este número não está registrado no WhatsApp. Verifique e tente novamente.",
                variant: "destructive",
              });
              setLoading(false);
              return;
            }
            // Use canonical number from WhatsApp (resolves 9th digit issue)
            canonicalNumber = result.canonicalNumber || numeroLimpo;
            profilePictureUrl = result.profilePictureUrl || null;
            profileName = result.profileName || null;
            console.log('[NewContactDialog] Número canônico:', canonicalNumber);
            console.log('[NewContactDialog] Foto de perfil:', profilePictureUrl ? 'sim' : 'não');
            console.log('[NewContactDialog] Nome do perfil:', profileName);
          }
        }
      } catch (validationError) {
        console.warn('[NewContactDialog] Validação de número falhou, continuando com número original:', validationError);
      }

      // Formatar mensagem com assinatura (apenas texto; por usuário; padrão ligado)
      const formattedMessage = signatureEnabled
        ? `*${agentName}*\n${mensagem.trim()}`
        : mensagem.trim();
      console.log('[NewContactDialog] Mensagem formatada:', formattedMessage);
      
      // Verificar se chat já existe com número canônico OU número original
      const { data: existingChat } = await supabase
        .from("chats")
        .select("*")
        .eq("organization_id", organizationId)
        .or(`phone.eq.${canonicalNumber},phone.eq.${numeroLimpo}`)
        .maybeSingle();

      let chatId: string;

      if (!existingChat) {
        // Criar novo chat com número canônico e dados do perfil
        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert([{
            phone: canonicalNumber,
            wa_name: profileName || nome || null,
            wa_photo_url: profilePictureUrl || null,
            organization_id: organizationId,
            agent_off: false,
          }])
          .select()
          .single();

        if (chatError) throw chatError;
        chatId = newChat.id;
        console.log('[NewContactDialog] Novo chat criado:', chatId);
      } else {
        chatId = existingChat.id;
        console.log('[NewContactDialog] Chat existente encontrado:', chatId);
        
        // Atualizar foto e nome se tivermos dados novos
        if (profilePictureUrl || profileName) {
          const updateData: any = {};
          if (profilePictureUrl && !existingChat.wa_photo_url) {
            updateData.wa_photo_url = profilePictureUrl;
          }
          if (profileName && !existingChat.wa_name) {
            updateData.wa_name = profileName;
          }
          if (Object.keys(updateData).length > 0) {
            await supabase.from("chats").update(updateData).eq("id", chatId);
          }
        }
      }

      // Verificar duplicatas nos últimos 5 minutos
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: duplicateMessage } = await supabase
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .eq('content', formattedMessage)
        .eq('is_from_user', true)
        .gte('created_at', fiveMinutesAgo)
        .maybeSingle();

      if (duplicateMessage) {
        console.log('[NewContactDialog] ⚠️ Mensagem duplicada detectada, ignorando envio');
        toast({
          title: "Mensagem duplicada",
          description: "Esta mensagem já foi enviada recentemente para este contato",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Inserir mensagem no banco
      const { data: insertedMessage, error: messageError } = await supabase
        .from("messages")
        .insert([{
          chat_id: chatId,
          organization_id: organizationId,
          content: formattedMessage,
          message_type: "text",
          is_from_user: true,
          sent_by: user?.id,
          sent_from_platform: true,
        }])
        .select()
        .single();

      if (messageError) {
        console.error('[NewContactDialog] Erro ao inserir mensagem:', messageError);
        throw messageError;
      }

      console.log('[NewContactDialog] Mensagem inserida:', insertedMessage.id);

      // Enviar mensagem via Evolution API
      try {
        const { data: sendData, error: sendError } = await supabase.functions.invoke('evolution-api', {
          body: { 
            action: 'send-text', 
            organization_id: organizationId, 
            number: canonicalNumber, 
            text: formattedMessage 
          },
        });
        const sendResult = { ok: !sendError, text: async () => JSON.stringify(sendData || sendError) };

        if (sendResult.ok) {
          console.log('[NewContactDialog] ✅ Mensagem enviada via Evolution API');
        } else {
          const errorData = await sendResult.text();
          console.error('[NewContactDialog] ❌ Erro ao enviar via Evolution API:', errorData);
          toast({
            title: "Aviso",
            description: "Mensagem salva, mas houve erro ao enviar para WhatsApp. A mensagem será enviada via webhook.",
            variant: "default",
          });
        }
      } catch (sendError) {
        console.error('[NewContactDialog] Erro ao enviar via Evolution API:', sendError);
      }

      // Buscar webhooks da organização e enviar
      const { data: orgWebhooks, error: webhooksError } = await (supabase as any)
        .from('webhook_configs')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('webhook_type', 'sent')
        .eq('active', true);

      console.log(`[NewContactDialog] Webhooks 'sent' encontrados para org ${organizationId}:`, orgWebhooks?.length || 0);

      if (orgWebhooks && orgWebhooks.length > 0) {
        const webhookPayload = {
          id: insertedMessage.id,
          numero: canonicalNumber,
          mensagem: formattedMessage,
          tipo: "text",
          "from-me": true,
          chat_id: chatId,
          created_at: insertedMessage.created_at,
        };

        console.log('[NewContactDialog] ===== ENVIANDO PARA WEBHOOKS =====');
        console.log('[NewContactDialog] Payload:', JSON.stringify(webhookPayload, null, 2));

        for (const webhook of orgWebhooks) {
          try {
            console.log(`[NewContactDialog] Enviando para ${webhook.name} (${webhook.url})`);
            
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              ...(webhook.headers as Record<string, string> || {}),
            };

            const response = await fetch(webhook.url, {
              method: "POST",
              headers,
              body: JSON.stringify(webhookPayload),
            });
            
            console.log(`[NewContactDialog] Webhook ${webhook.name} - Status: ${response.status}`);
            
            if (!response.ok) {
              const text = await response.text();
              console.error(`[NewContactDialog] Webhook ${webhook.name} - Erro:`, text);
            } else {
              console.log(`[NewContactDialog] ✅ Webhook ${webhook.name} enviado com sucesso!`);
            }
          } catch (webhookError) {
            console.error(`[NewContactDialog] ❌ Erro ao enviar webhook ${webhook.name}:`, webhookError);
          }
        }
      } else {
        console.warn('[NewContactDialog] Nenhum webhook "sent" ativo encontrado para org:', organizationId);
      }

      // Atualizar interface
      toast({
        title: "Sucesso",
        description: "Contato criado e mensagem enviada com sucesso!",
      });

      // Emitir evento customizado
      window.dispatchEvent(new CustomEvent("chat-created", { detail: { chatId } }));

      // Atualizar lista e selecionar chat
      onRefresh();
      onChatCreated(chatId);

      // Limpar formulário
      setNome("");
      setNumero("");
      setMensagem("");
      setOpen(false);
    } catch (error) {
      console.error("Erro ao criar contato:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 md:px-3" aria-label="Novo contato">
                <MessageSquarePlus className="h-4 w-4 shrink-0" />
                <span className="text-xs hidden sm:inline">Novo contato</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Novo contato
          </TooltipContent>
        </Tooltip>

        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome (Opcional)</Label>
            <Input
              id="nome"
              placeholder="Nome do contato"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              O nome será buscado automaticamente do WhatsApp se disponível
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="numero">
              Número <span className="text-destructive">*</span>
            </Label>
            <Input
              id="numero"
              placeholder="Ex: 5511999999999"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensagem">
              Mensagem <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="mensagem"
              placeholder="Digite a mensagem inicial"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              disabled={loading}
              rows={4}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar Mensagem"}
            </Button>
          </div>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};