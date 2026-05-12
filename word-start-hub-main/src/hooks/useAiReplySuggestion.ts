import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useToast } from "@/hooks/use-toast";

interface AiPromptRecord {
  id: string;
  name: string;
  isHead: boolean;
  fieldCount: number;
  fields: Array<{ key: string; value: string; id: string }>;
}

interface UseAiReplySuggestionResult {
  generate: (chatId: string, promptId: string) => Promise<string | null>;
  isGenerating: boolean;
  prompts: AiPromptRecord[];
  loadingPrompts: boolean;
  loadPrompts: () => Promise<void>;
}

/**
 * Hook responsible for generating AI reply suggestions based on
 * the last 30 messages of a chat and the org's configured I.A prompt.
 *
 * The caller receives the generated text and is responsible for
 * placing it in the message input — nothing is sent automatically.
 */
export function useAiReplySuggestion(): UseAiReplySuggestionResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompts, setPrompts] = useState<AiPromptRecord[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const loadPrompts = useCallback(async () => {
    if (!currentOrganization?.id) return;
    setLoadingPrompts(true);
    try {
      const { data, error } = await supabase
        .from("ai_prompts")
        .select("id, fields")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const cleaned: AiPromptRecord[] = (data || []).map((p: any) => {
        const metaField = (p.fields || []).find((f: any) => f.key === "_metadata");
        let parsedMeta: any = null;
        try {
          if (metaField?.value) parsedMeta = JSON.parse(metaField.value);
        } catch { /* noop */ }

        const contentFields = (p.fields || []).filter((f: any) => f.key !== "_metadata");
        const isHead = parsedMeta?.is_head_prompt === true;

        return {
          id: p.id,
          name: p.name || parsedMeta?.name || "Prompt sem nome",
          isHead,
          fieldCount: contentFields.length,
          fields: contentFields,
        };
      });

      // Sort: head prompt first, then alphabetical
      cleaned.sort((a, b) => {
        if (a.isHead && !b.isHead) return -1;
        if (!a.isHead && b.isHead) return 1;
        return a.name.localeCompare(b.name);
      });

      setPrompts(cleaned);
    } catch (err) {
      console.error("[useAiReplySuggestion] loadPrompts error:", err);
    } finally {
      setLoadingPrompts(false);
    }
  }, [currentOrganization?.id]);

  const generate = useCallback(
    async (chatId: string, promptId: string): Promise<string | null> => {
      if (!currentOrganization?.id) {
        toast({
          title: "Organização não encontrada",
          variant: "destructive",
        });
        return null;
      }

      setIsGenerating(true);
      try {
        // 1. Load last 30 messages of the chat
        const { data: messages, error: msgErr } = await supabase
          .from("messages")
          .select("id, content, is_from_user, message_type, created_at, file_url, file_name")
          .eq("chat_id", chatId)
          .eq("organization_id", currentOrganization.id)
          .not("message_type", "eq", "system")
          .order("created_at", { ascending: false })
          .limit(30);

        if (msgErr) throw msgErr;

        let recentMessages = (messages || []).reverse();

        // 2. Load AI credential: use the org's first configured credential
        // or fall back to the Vitta platform Gemini key
        const { data: orgCreds } = await supabase
          .from("ai_agent_credentials")
          .select("id, provider")
          .eq("organization_id", currentOrganization.id)
          .order("created_at", { ascending: true })
          .limit(1);

        const firstCred = orgCreds?.[0] ?? null;
        const credentialId = firstCred?.id || "vitta-gemini";
        const resolvedProvider = firstCred?.provider || "gemini";
        const model = resolvedProvider === "openai" ? "gpt-4o-mini" : "gemini-2.5-flash";
        const temperature = 0.7;

        // 3. Lazy parsing: if any recent message is an audio/image/pdf without content, parse it first
        const messagesToParse = recentMessages.filter((m: any) => {
          if (m.content && m.content.trim() !== "") return false;
          if (!m.file_url) return false;
          if (m.message_type === "audio" || m.message_type === "image") return true;
          if (m.message_type === "document" && m.file_name?.toLowerCase().endsWith(".pdf")) return true;
          return false;
        });

        if (messagesToParse.length > 0) {
          const { error: parseErr } = await supabase.functions.invoke("parse-chat-media", {
            body: {
              messageIds: messagesToParse.map((m: any) => m.id),
              credentialId,
              organizationId: currentOrganization.id
            }
          });

          if (!parseErr) {
            // Re-fetch to get updated contents
            const messageIds = recentMessages.map((m: any) => m.id);
            const { data: updatedMsgs } = await supabase
              .from("messages")
              .select("id, content")
              .in("id", messageIds);

            if (updatedMsgs) {
              recentMessages = recentMessages.map((oldM: any) => {
                const refreshed = updatedMsgs.find((u: any) => u.id === oldM.id);
                return refreshed && refreshed.content ? { ...oldM, content: refreshed.content } : oldM;
              });
            }
          } else {
            console.warn("[useAiReplySuggestion] parse media error:", parseErr);
          }
        }

        // 2. Load the selected prompt's fields
        if (!promptId) {
          toast({
            title: "Selecione um prompt",
            description: "Escolha qual prompt usar para gerar a resposta.",
            variant: "destructive",
          });
          return null;
        }

        let promptFields: Array<{ key: string; value: string }> = [];
        const { data: pData } = await supabase
          .from("ai_prompts")
          .select("fields")
          .eq("id", promptId)
          .maybeSingle();

        if (pData?.fields) {
          promptFields = (pData.fields as any[]).filter(
            (f) => f.key !== "_metadata" && f.value?.trim()
          );
        }

        if (promptFields.length === 0) {
          toast({
            title: "Prompt sem conteúdo",
            description: "Este prompt não tem campos preenchidos. Edite-o em Automações > I.A.",
            variant: "destructive",
          });
          return null;
        }

        // 3. Build system message from prompt fields
        const systemMessage = promptFields
          .filter((f) => f.value?.trim())
          .map((f) => `## ${f.key}\n${f.value}`)
          .join("\n\n");

        // (Credentials already loaded above)

        // 5. Format conversation history for context
        const conversationHistory = recentMessages
          .map((m: any) => {
            const role = m.is_from_user ? "Lead" : "Atendente";
            const content = m.content || `[${m.message_type || "mídia"}]`;
            return `${role}: ${content}`;
          })
          .join("\n");

        const userPrompt = `Você é um assistente de atendimento. Analise a conversa abaixo e gere a PRÓXIMA resposta que o ATENDENTE deve enviar ao lead. 

Responda APENAS com o texto da mensagem a ser enviada, sem prefixos como "Atendente:" ou explicações adicionais. A mensagem deve ser natural, empática e seguir as diretrizes do prompt de atendimento.

CONVERSA RECENTE:
${conversationHistory}

Gere a resposta do atendente:`;

        // 6. Call ai-agent-execute edge function
        const { data: result, error: aiErr } = await supabase.functions.invoke(
          "ai-agent-execute",
          {
            body: {
              prompt: userPrompt,
              system_message: systemMessage,
              model,
              provider: resolvedProvider,
              credential_id: credentialId,
              organization_id: currentOrganization.id,
              memory_key: null,
              context_window_length: 0,
              temperature,
              max_iterations: 1,
              tools: [],
              input_data: {},
            },
          }
        );

        if (aiErr) throw aiErr;
        if (result?.error) throw new Error(result.message || "Erro na I.A");

        const output = result?.output?.trim() || "";

        if (!output) {
          toast({
            title: "I.A não gerou resposta",
            description: "Tente novamente ou revise o prompt configurado.",
            variant: "destructive",
          });
          return null;
        }

        return output;
      } catch (err: any) {
        console.error("[useAiReplySuggestion] generate error:", err);
        toast({
          title: "Erro ao gerar resposta com I.A",
          description:
            err.message?.includes("credential") || err.message?.includes("Credencial")
              ? "Configure uma credencial de I.A válida nas Automações."
              : err.message || "Ocorreu um erro inesperado",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [currentOrganization?.id, toast]
  );

  return { generate, isGenerating, prompts, loadingPrompts, loadPrompts };
}
