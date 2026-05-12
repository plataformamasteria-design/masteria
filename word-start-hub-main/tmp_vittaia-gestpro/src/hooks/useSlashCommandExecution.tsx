import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/use-toast';

interface ExecutionState {
  isExecuting: boolean;
  executionId: string | null;
  commandId: string;
  commandName: string;
  currentStep: number;
  totalSteps: number;
}

interface CommandStep {
  id: string;
  step_order: number;
  message_type: 'text' | 'audio' | 'image' | 'pdf' | 'video';
  content: string | null;
  file_url: string | null;
  file_name: string | null;
}

const DEFAULT_DELAY_SECONDS = 5;

export function useSlashCommandExecution(chatId: string) {
  const { currentOrganization } = useOrganization();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const cancelledRef = useRef(false);
  const executionIdRef = useRef<string | null>(null);

  const checkActiveExecution = useCallback(async (): Promise<boolean> => {
    const { data } = await supabase
      .from('slash_command_executions')
      .select('id')
      .eq('chat_id', chatId)
      .eq('status', 'running')
      .maybeSingle();

    return !!data;
  }, [chatId]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeCommand = useCallback(async (
    commandId: string, 
    commandName: string,
    commandShortcut: string,
    delaySeconds?: number
  ) => {
    if (!currentOrganization?.id || !user?.id) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para executar comandos',
        variant: 'destructive',
      });
      return false;
    }

    // Check for active execution
    const hasActiveExecution = await checkActiveExecution();
    if (hasActiveExecution) {
      toast({
        title: 'Execução em andamento',
        description: 'Aguarde a conclusão do comando atual',
        variant: 'destructive',
      });
      return false;
    }

    // Fetch command steps
    const { data: steps, error: stepsError } = await supabase
      .from('slash_command_steps')
      .select('*')
      .eq('command_id', commandId)
      .order('step_order');

    if (stepsError || !steps || steps.length === 0) {
      toast({
        title: 'Erro',
        description: 'Este comando não possui mensagens configuradas',
        variant: 'destructive',
      });
      return false;
    }

    // Fetch chat phone
    const { data: chat } = await supabase
      .from('chats')
      .select('phone')
      .eq('id', chatId)
      .single();

    if (!chat?.phone) {
      toast({
        title: 'Erro',
        description: 'Não foi possível obter o telefone do chat',
        variant: 'destructive',
      });
      return false;
    }

    // Use provided delay or default
    const delayMs = (delaySeconds ?? DEFAULT_DELAY_SECONDS) * 1000;

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('slash_command_executions')
      .insert({
        command_id: commandId,
        chat_id: chatId,
        organization_id: currentOrganization.id,
        executed_by: user.id,
        status: 'running',
        current_step: 1,
        total_steps: steps.length,
      })
      .select()
      .single();

    if (execError || !execution) {
      toast({
        title: 'Erro',
        description: 'Não foi possível iniciar a execução do comando',
        variant: 'destructive',
      });
      return false;
    }

    executionIdRef.current = execution.id;
    cancelledRef.current = false;

    setExecutionState({
      isExecuting: true,
      executionId: execution.id,
      commandId,
      commandName,
      currentStep: 0,
      totalSteps: steps.length,
    });

    // Execute steps
    for (let i = 0; i < steps.length; i++) {
      if (cancelledRef.current) break;

      const step = steps[i] as CommandStep;
      
      // Update progress
      setExecutionState(prev => prev ? { ...prev, currentStep: i + 1 } : null);

      // Update execution record
      await supabase
        .from('slash_command_executions')
        .update({ current_step: i + 1 })
        .eq('id', execution.id);

      // Prepare message content (sem assinatura do usuário)
      let content = '';
      let messageType = step.message_type;

      if (step.message_type === 'text' && step.content) {
        content = step.content;
      } else if (step.file_url) {
        content = step.file_name || (step.message_type === 'audio' ? '🎤 Áudio' : '📷 Imagem');
      }

      // Insert message with sent_from_platform: true to trigger webhooks
      const { data: insertedMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          organization_id: currentOrganization.id,
          content: step.message_type === 'text' ? content : null,
          message_type: messageType,
          file_url: step.file_url,
          file_name: step.file_name,
          is_from_user: true,
          sent_by: user.id,
          private: false,
          sent_from_platform: true, // Mark as platform message to trigger webhooks
        })
        .select()
        .single();

      // Use standardized trigger-sent-webhooks function instead of custom webhook logic
      if (!msgError && insertedMessage) {
        try {
          console.log('[useSlashCommandExecution] Triggering webhooks for message:', insertedMessage.id);
          await supabase.functions.invoke('trigger-sent-webhooks', {
            body: { messageId: insertedMessage.id }
          });
        } catch (webhookError) {
          console.error('[useSlashCommandExecution] Error triggering webhooks:', webhookError);
          // Don't fail command execution if webhook fails
        }
      }

      // Wait before next message (except for last one)
      if (i < steps.length - 1 && !cancelledRef.current) {
        await sleep(delayMs);
      }
    }

    // Update execution status
    const finalStatus = cancelledRef.current ? 'cancelled' : 'completed';
    await supabase
      .from('slash_command_executions')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        current_step: cancelledRef.current ? executionState?.currentStep : steps.length,
      })
      .eq('id', execution.id);

    // Keep showing completion for a moment
    if (!cancelledRef.current) {
      setExecutionState(prev => prev ? { ...prev, currentStep: steps.length } : null);
      await sleep(2000);
    }

    setExecutionState(null);
    executionIdRef.current = null;

    if (!cancelledRef.current) {
      toast({
        title: 'Comando executado',
        description: `/${commandShortcut} foi enviado com sucesso`,
      });
    }

    return true;
  }, [chatId, currentOrganization?.id, user?.id, toast, checkActiveExecution]);

  const cancelExecution = useCallback(async () => {
    cancelledRef.current = true;
    
    if (executionIdRef.current) {
      await supabase
        .from('slash_command_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', executionIdRef.current);
    }

    setExecutionState(null);
    executionIdRef.current = null;

    toast({
      title: 'Execução cancelada',
      description: 'O comando foi cancelado',
    });
  }, [toast]);

  return {
    executionState,
    executeCommand,
    cancelExecution,
    isExecuting: !!executionState?.isExecuting,
  };
}
