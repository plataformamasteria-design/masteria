import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { trigger_type, chat_id, stage_id, funnel_id, organization_id, resume_execution_id, start_from_nodes } = body;

    if (!organization_id || !chat_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle resume mode
    if (resume_execution_id && start_from_nodes) {
      const { data: execution } = await supabase
        .from("automation_executions")
        .select("*")
        .eq("id", resume_execution_id)
        .single();

      if (!execution) {
        return new Response(JSON.stringify({ error: "Execution not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from("automation_nodes").select("*").eq("automation_id", execution.automation_id).eq("organization_id", organization_id),
        supabase.from("automation_edges").select("*").eq("automation_id", execution.automation_id).eq("organization_id", organization_id),
      ]);

      await processFlow(supabase, execution, nodesRes.data || [], edgesRes.data || [], organization_id, chat_id, start_from_nodes);

      return new Response(JSON.stringify({ message: "Resumed", execution_id: resume_execution_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active automations matching this trigger
    let query = supabase
      .from("automations")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .eq("trigger_type", trigger_type);

    if (trigger_type === "stage_entry") {
      query = query.eq("trigger_stage_id", stage_id);
      if (funnel_id) query = query.eq("funnel_id", funnel_id);
    } else if (trigger_type === "message_received") {
      if (funnel_id) query = query.eq("funnel_id", funnel_id);
      if (stage_id) query = query.eq("trigger_stage_id", stage_id);
    }

    const { data: automations, error: automationsError } = await query;

    if (automationsError) {
      console.error("Error fetching automations:", automationsError);
      return new Response(JSON.stringify({ error: automationsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "No matching automations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    for (const automation of automations) {
      // DEDUPLICATION: check for active executions
      const { data: existingExec } = await supabase
        .from("automation_executions")
        .select("id, status, resume_at, context")
        .eq("automation_id", automation.id)
        .eq("chat_id", chat_id)
        .eq("organization_id", organization_id)
        .in("status", ["running", "waiting", "waiting_response", "loop_completed"])
        .limit(5);

      if (existingExec && existingExec.length > 0) {
        // Check if any are truly active (not loop_completed past their restart time)
        const activeExec = existingExec.find((ex: any) => {
          if (ex.status === "loop_completed") {
            // Allow re-trigger if restart time has passed
            if (ex.resume_at && new Date(ex.resume_at) <= new Date()) {
              return false; // Not blocking - restart time passed
            }
            return true; // Still within cooldown
          }
          return true; // running/waiting/waiting_response are always blocking
        });

        if (activeExec) {
          console.log(`Skipping automation ${automation.id} - already active: ${activeExec.id}`);
          results.push({ automation_id: automation.id, status: "skipped", reason: "already_running" });
          continue;
        }

        // Clear expired loop_completed executions so they don't block future ones
        const expiredLoops = existingExec.filter((ex: any) =>
          ex.status === "loop_completed" && ex.resume_at && new Date(ex.resume_at) <= new Date()
        );
        for (const expired of expiredLoops) {
          await supabase.from("automation_executions")
            .update({ status: "completed" })
            .eq("id", expired.id);
        }
      }

      // Also check if bot is permanently stopped for this chat
      const { data: chatBotCheck } = await supabase
        .from("chats")
        .select("bot_permanently_stopped")
        .eq("id", chat_id)
        .maybeSingle();

      if (chatBotCheck?.bot_permanently_stopped === true) {
        console.log(`Skipping automation ${automation.id} - bot permanently stopped for chat ${chat_id}`);
        results.push({ automation_id: automation.id, status: "skipped", reason: "bot_permanently_stopped" });
        continue;
      }

      // Get nodes and edges in parallel
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from("automation_nodes").select("*").eq("automation_id", automation.id).eq("organization_id", organization_id),
        supabase.from("automation_edges").select("*").eq("automation_id", automation.id).eq("organization_id", organization_id),
      ]);

      const nodes = nodesRes.data || [];
      const edges = edgesRes.data || [];
      if (nodes.length === 0) continue;

      const triggerNode = nodes.find((n: any) => n.node_type === "trigger");
      const { data: execution, error: execError } = await supabase
        .from("automation_executions")
        .insert({
          automation_id: automation.id,
          organization_id,
          chat_id,
          status: "running",
          current_node_id: triggerNode?.id || nodes[0].id,
          context: { trigger_type, stage_id, funnel_id },
        })
        .select()
        .single();

      if (execError) {
        console.error("Error creating execution:", execError);
        continue;
      }

      try {
        await processFlow(supabase, execution, nodes, edges, organization_id, chat_id);
        results.push({ automation_id: automation.id, execution_id: execution.id, status: "completed" });
      } catch (flowError: any) {
        console.error("Flow error:", flowError);
        await supabase
          .from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        results.push({ automation_id: automation.id, execution_id: execution.id, status: "failed", error: flowError.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Executor error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processFlow(
  supabase: any,
  execution: any,
  nodes: any[],
  edges: any[],
  organizationId: string,
  chatId: string,
  startFromNodes?: string[]
) {
  let startNodes: string[];
  if (startFromNodes && startFromNodes.length > 0) {
    startNodes = startFromNodes;
  } else {
    const triggerNode = nodes.find((n) => n.node_type === "trigger");
    if (!triggerNode) return;
    startNodes = [triggerNode.id];
  }

  const visited = new Set<string>();
  const queue: string[] = [...startNodes];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    if (visited.has(currentNodeId)) continue;
    visited.add(currentNodeId);

    const node = nodes.find((n) => n.id === currentNodeId);
    if (!node) continue;

    // Fire-and-forget: update current_node + increment stats in parallel (don't await)
    const statsPromise = Promise.all([
      supabase.from("automation_executions").update({ current_node_id: currentNodeId }).eq("id", execution.id),
      supabase.rpc("increment_node_stat_reached", {
        p_node_id: currentNodeId,
        p_automation_id: execution.automation_id,
        p_organization_id: organizationId,
        p_chat_id: chatId,
      }).then(({ error }: any) => { if (error) console.log("Stats error (non-critical):", error); }),
    ]);

    // Skip executeNode for nodes handled directly in processFlow
    const isDialogueAI = node.node_type === "ai_agent" && node.config?.dialogue_mode;
    const isFollowUpAI = node.node_type === "follow_up_ai";
    if (!isDialogueAI && !isFollowUpAI) {
      const result = await executeNode(supabase, node, organizationId, chatId, execution.context);

      // Log execution result in background (fire-and-forget)
      supabase.from("automation_execution_logs").insert({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: result.success ? "success" : "error",
        message: result.message || null,
      }).then(({ error }: any) => { if (error) console.log("Log insert error:", error); });
    }

    // Wait for stats to finish before moving on (they're fast)
    await statsPromise;

    // Find next nodes
    const outEdges = edges.filter((e: any) => e.source_node_id === currentNodeId);

    if (node.node_type === "condition") {
      const condConfig = node.config || {};
      const isResponseCondition = condConfig.condition_type === "response_equals" || condConfig.condition_type === "response_contains" || condConfig.condition_type === "response_is_one_of" || condConfig.condition_type === "response_in";

      if (isResponseCondition && !execution.context?.last_response) {
        // Response-based condition: pause and wait for lead's response (like wait_response)
        await supabase.from("automation_executions")
          .update({
            status: "waiting_response",
            current_node_id: currentNodeId,
            resume_at: null,
            context: { ...execution.context, wait_node_id: currentNodeId, immediate_response: true, condition_wait: true },
          })
          .eq("id", execution.id);
        return;
      }

      const conditionResult = evaluateCondition(condConfig, execution.context);
      // Clear last_response after evaluating so subsequent conditions can wait again
      if (isResponseCondition) {
        execution.context = { ...execution.context, last_response: undefined };
      }
      const handleId = conditionResult ? "yes" : "no";
      const matchingEdge = outEdges.find((e: any) => e.source_handle_id === handleId) || outEdges[0];
      if (matchingEdge) queue.push(matchingEdge.target_node_id);
    } else if (node.node_type === "delay") {
      const config = node.config || {};
      const amount = parseInt(config.amount || "1", 10);
      const unit = config.unit || "hours";
      let delayMs = amount * 1000; // default seconds
      if (unit === "minutes") delayMs = amount * 60 * 1000;
      else if (unit === "hours") delayMs = amount * 60 * 60 * 1000;
      else if (unit === "days") delayMs = amount * 24 * 60 * 60 * 1000;
      const resumeAt = new Date(Date.now() + delayMs).toISOString();

      await supabase.from("automation_executions")
        .update({ status: "waiting", current_node_id: currentNodeId, resume_at: resumeAt })
        .eq("id", execution.id);
      return;
    } else if (node.node_type === "wait_response" || node.node_type === "ask_question") {
      const config = node.config || {};
      const immediateResponse = config.immediate_response === true;

      let resumeAt: string | null = null;
      if (!immediateResponse) {
        const amount = parseInt(config.timeout_amount || "24", 10);
        const unit = config.timeout_unit || "hours";
        let timeoutMs = amount * 1000; // default seconds
        if (unit === "minutes") timeoutMs = amount * 60 * 1000;
        else if (unit === "hours") timeoutMs = amount * 60 * 60 * 1000;
        else if (unit === "days") timeoutMs = amount * 24 * 60 * 60 * 1000;
        resumeAt = new Date(Date.now() + timeoutMs).toISOString();
      }

      await supabase.from("automation_executions")
        .update({
          status: "waiting_response",
          current_node_id: currentNodeId,
          resume_at: resumeAt,
          context: { ...execution.context, wait_node_id: currentNodeId, immediate_response: immediateResponse },
        })
        .eq("id", execution.id);
      return;
    } else if (node.node_type === "ai_agent" && node.config?.dialogue_mode) {
      // === CHECK BOT STATUS based on node config toggles ===
      const requireGlobalBot = node.config.require_global_bot ?? true;
      const requireLeadBot = node.config.require_lead_bot ?? true;

      if (requireGlobalBot || requireLeadBot) {
        const botAllowed = await checkBotStatusConfigurable(supabase, organizationId, chatId, requireGlobalBot, requireLeadBot);
        if (!botAllowed) {
          console.log(`[ai_agent] Bot is disabled. Skipping AI agent node. (global_check=${requireGlobalBot}, lead_check=${requireLeadBot})`);
          await supabase.from("automation_execution_logs").insert({
            execution_id: execution.id,
            node_id: currentNodeId,
            organization_id: organizationId,
            status: "success",
            message: "⚠️ Robô desativado (global ou para este lead). Nó de I.A ignorado.",
          });
          for (const edge of outEdges) queue.push(edge.target_node_id);
          continue;
        }
      }

      // Dialogue mode: AI agent loops with the lead
      const dialogueContext = execution.context?.dialogue_context || {};
      const currentTurn = dialogueContext.current_turn || 0;
      const maxTurns = node.config.max_dialogue_turns || 10;

      const aiProvider = node.config.provider || "openai";
      const isVittaCredential = ["vitta-openai", "vitta-gemini"].includes(node.config?.credential_id || "");

      // Check token balance before calling AI (only for Vitta I.A credential)
      // If no tokens, SKIP the AI node and continue the flow
      if (isVittaCredential) {
        const { data: tokenBalance } = await supabase
          .from("organization_token_balances")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("provider", aiProvider)
          .maybeSingle();

        if (tokenBalance) {
          const remaining = (tokenBalance.total_tokens || 0) - (tokenBalance.used_tokens || 0);
          if (remaining <= 0) {
            const providerName = aiProvider === "openai" ? "ChatGPT" : "Gemini";
            console.warn(`[dialogue] Tokens esgotados para ${providerName}. Pulando nó de I.A e continuando fluxo.`);
            await supabase.from("automation_execution_logs").insert({
              execution_id: execution.id,
              node_id: currentNodeId,
              organization_id: organizationId,
              status: "error",
              message: `⚠️ Tokens de ${providerName} esgotados (saldo: ${remaining}). Nó de I.A ignorado — fluxo continua. Recarregue em Meu Plano.`,
            });
            // Continue to next nodes instead of failing
            for (const edge of outEdges) queue.push(edge.target_node_id);
            continue;
          }
        }
      }

      // Validate credential before calling
      if (!node.config.credential_id) {
        console.error("[dialogue] No credential_id configured for AI agent node");
        // Log error and stop flow at this node
        await supabase.from("automation_execution_logs").insert({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: "Credencial de I.A não configurada. Configure na aba 'Modelo' do nó Agente I.A.",
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        return;
      }

      // Call AI agent
      const aiResult = await executeDialogueAIAgent(supabase, node, organizationId, chatId, execution.context, execution.id);

      if (!aiResult.success) {
        console.error("[dialogue] AI agent failed:", aiResult.message);
        // Log the error but DON'T advance - stop the flow
        await supabase.from("automation_execution_logs").insert({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: `Erro no Agente I.A: ${aiResult.message}`,
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        return;
      }

      // Deduct tokens from balance (only for Vitta I.A credential)
      if (isVittaCredential && aiResult.usage && aiResult.usage.total_tokens > 0) {
        const aiProv = node.config.provider || "openai";
        const { data: curBal } = await supabase
          .from("organization_token_balances")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("provider", aiProv)
          .maybeSingle();

        if (curBal) {
          await supabase.from("organization_token_balances")
            .update({ used_tokens: (curBal.used_tokens || 0) + aiResult.usage.total_tokens })
            .eq("id", curBal.id);
        }

        // Record consumption transaction
        supabase.from("token_transactions").insert({
          organization_id: organizationId,
          provider: aiProv,
          transaction_type: "consumption",
          amount: aiResult.usage.total_tokens,
          description: `Automação diálogo turno ${currentTurn + 1} | chat ${chatId}`,
          automation_execution_id: execution.id,
        }).then(() => { });
      }

      // Log success for this dialogue turn with token usage
      const turnMsg = aiResult.message || `Turno ${currentTurn + 1} do diálogo`;
      let usageInfo = "";
      if (aiResult.usage) {
        if (aiResult.humanize_usage) {
          const orig = aiResult.usage.total_tokens - aiResult.humanize_usage.total_tokens;
          const hum = aiResult.humanize_usage.total_tokens;
          usageInfo = ` | Tokens: ${aiResult.usage.total_tokens} (prompt: ${aiResult.usage.prompt_tokens}, completion: ${aiResult.usage.completion_tokens}) | Geração: ${orig} + Humanização: ${hum} = ${aiResult.usage.total_tokens} tokens`;
        } else {
          usageInfo = ` | Tokens: ${aiResult.usage.total_tokens} (prompt: ${aiResult.usage.prompt_tokens}, completion: ${aiResult.usage.completion_tokens})`;
        }
      }
      supabase.from("automation_execution_logs").insert({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: `Turn ${currentTurn + 1} completed` + usageInfo,
      }).then(() => { });

      // Check if the AI detected objective completion or we hit max turns
      const shouldEnd = aiResult.dialogue_ended || (currentTurn + 1) >= maxTurns;

      if (shouldEnd) {
        console.log(`[dialogue] Ending dialogue after ${currentTurn + 1} turns. Reason: ${aiResult.dialogue_ended ? 'objective_completed' : 'max_turns'}`);
        // CRITICAL: Reset dialogue context so next AI agent nodes start fresh
        execution.context = {
          ...execution.context,
          dialogue_mode: false,
          dialogue_context: undefined,
          wait_node_id: undefined,
          immediate_response: undefined,
          last_response: undefined,
          last_response_at: undefined,
        };
        // Persist the cleaned context
        await supabase.from("automation_executions")
          .update({ context: execution.context })
          .eq("id", execution.id);
        // Follow only the "completed" handle
        const completedEdge = outEdges.find((e: any) => e.source_handle_id === "completed");
        if (completedEdge) {
          queue.push(completedEdge.target_node_id);
        } else {
          // Fallback: follow all edges if no specific handle
          for (const edge of outEdges) queue.push(edge.target_node_id);
        }
      } else {
        // Pause and wait for lead's response, then loop back to this same node
        // In dialogue mode, timeout is counted from the LAST lead response (inactivity per turn)
        const timeoutAmount = node.config?.timeout_amount || "30";
        const timeoutUnit = node.config?.timeout_unit || "minutes";
        const hasTimeout = node.config?.timeout_enabled !== false && Number(timeoutAmount) > 0;
        const lastResponseAt = execution.context?.last_response_at;
        const lastResponseMs = lastResponseAt ? new Date(lastResponseAt).getTime() : NaN;
        const timeoutBaseMs = Number.isFinite(lastResponseMs) ? lastResponseMs : Date.now();
        const dialogueResumeAt = hasTimeout
          ? new Date(timeoutBaseMs + toMsFromAmountUnit(timeoutAmount, timeoutUnit, 24 * 60 * 60 * 1000)).toISOString()
          : null;

        await supabase.from("automation_executions")
          .update({
            status: "waiting_response",
            current_node_id: currentNodeId,
            resume_at: dialogueResumeAt,
            context: {
              ...execution.context,
              wait_node_id: currentNodeId,
              immediate_response: true,
              dialogue_mode: true,
              dialogue_context: {
                ...dialogueContext,
                current_turn: currentTurn + 1,
                node_id: currentNodeId,
              },
            },
          })
          .eq("id", execution.id);
        return; // Pause execution
      }
    } else if (node.node_type === "follow_up_ai") {
      const requireGlobalBot = node.config?.require_global_bot ?? true;
      const requireLeadBot = node.config?.require_lead_bot ?? true;

      if (requireGlobalBot || requireLeadBot) {
        const botAllowed = await checkBotStatusConfigurable(supabase, organizationId, chatId, requireGlobalBot, requireLeadBot);
        if (!botAllowed) {
          console.log(`[follow_up_ai] Bot is disabled. Skipping follow-up send. (global_check=${requireGlobalBot}, lead_check=${requireLeadBot})`);
          await supabase.from("automation_execution_logs").insert({
            execution_id: execution.id,
            node_id: currentNodeId,
            organization_id: organizationId,
            status: "success",
            message: "⚠️ Robô desativado (global ou para este lead). Follow Up I.A ignorado.",
          });

          const notRespondedEdge = outEdges.find((e: any) => e.source_handle_id === "not_responded");
          if (notRespondedEdge) {
            queue.push(notRespondedEdge.target_node_id);
          } else {
            for (const edge of outEdges) queue.push(edge.target_node_id);
          }
          continue;
        }
      }

      const followResult = await executeFollowUpAIAgent(supabase, node, organizationId, chatId, execution.context, execution.id);

      if (!followResult.success) {
        await supabase.from("automation_execution_logs").insert({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: `Erro no Follow Up I.A: ${followResult.message}`,
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        return;
      }

      const timeoutMs = toMsFromAmountUnit(node.config?.timeout_amount || "8", node.config?.timeout_unit || "hours", 8 * 60 * 60 * 1000);
      const resumeAt = new Date(Date.now() + timeoutMs).toISOString();

      await supabase.from("automation_executions")
        .update({
          status: "waiting_response",
          current_node_id: currentNodeId,
          resume_at: resumeAt,
          context: {
            ...execution.context,
            wait_node_id: currentNodeId,
            immediate_response: false,
            follow_up_ai_mode: true,
            follow_up_last_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", execution.id);

      await supabase.from("automation_execution_logs").insert({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: `Follow-up enviado e aguardando resposta por ${node.config?.timeout_amount || "8"} ${node.config?.timeout_unit || "hours"}`,
      });

      return;
    } else if (node.node_type === "loop_restart") {
      // Loop restart: complete execution but mark with a delay so it can be re-triggered
      const config = node.config || {};
      const restartDelay = parseInt(config.restart_delay || "8", 10);
      const restartUnit = config.restart_unit || "hours";
      let delayMs = restartDelay * 60 * 60 * 1000;
      if (restartUnit === "minutes") delayMs = restartDelay * 60 * 1000;
      else if (restartUnit === "days") delayMs = restartDelay * 24 * 60 * 60 * 1000;

      const restartAt = new Date(Date.now() + delayMs).toISOString();

      // Complete the current execution with loop_completed status
      // Set resume_at so that the deduplication logic allows new triggers after this time
      await supabase.from("automation_executions")
        .update({
          status: "loop_completed",
          completed_at: new Date().toISOString(),
          resume_at: restartAt,
          context: { ...execution.context, loop_restart: true, restart_at: restartAt },
        })
        .eq("id", execution.id);

      // Re-enable the bot for this chat so next message can trigger again
      // Keep bot_finished_at so the notification stays visible until manually cleared
      await supabase.from("chats")
        .update({ agent_off: false })
        .eq("id", chatId);

      // Log
      supabase.from("automation_execution_logs").insert({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: `🔄 Loop configurado: automação reativável após ${restartDelay} ${restartUnit} (${restartAt})`,
      }).then(() => { });

      return; // End execution here
    } else if (node.node_type === "stop_bot") {
      // Stop bot permanently - already handled in executeNode, just continue
      for (const edge of outEdges) queue.push(edge.target_node_id);
    } else if (node.node_type === "ai_agent" && !node.config?.dialogue_mode) {
      // Non-dialogue AI agent: check if timeout is configured
      const hasTimeout = node.config?.timeout_enabled !== false && Number(node.config?.timeout_amount || 0) > 0;
      if (hasTimeout) {
        // Wait for lead response with timeout, then route to completed/timeout
        const timeoutMs = toMsFromAmountUnit(node.config.timeout_amount, node.config.timeout_unit || "minutes", 30 * 60 * 1000);
        const resumeAt = new Date(Date.now() + timeoutMs).toISOString();
        await supabase.from("automation_executions")
          .update({
            status: "waiting_response",
            current_node_id: currentNodeId,
            resume_at: resumeAt,
            context: {
              ...execution.context,
              wait_node_id: currentNodeId,
              immediate_response: false,
              ai_agent_timeout_mode: true,
            },
          })
          .eq("id", execution.id);
        return;
      } else {
        // No timeout: follow "completed" handle or all edges
        const completedEdge = outEdges.find((e: any) => e.source_handle_id === "completed");
        if (completedEdge) {
          queue.push(completedEdge.target_node_id);
        } else {
          for (const edge of outEdges) queue.push(edge.target_node_id);
        }
      }
    } else if (node.node_type === "intent_router") {
      // Route based on the classified intent
      const classifiedIntent = execution.context[`node_${node.id}_classified_intent`] || "";
      // The source_handle_id matches the intent name (uppercase with underscores)
      const matchingEdge = outEdges.find((e: any) => {
        const handleId = (e.source_handle_id || "").toUpperCase().replace(/[^A-ZÀ-Ú0-9_]/g, "_");
        const intentId = classifiedIntent.toUpperCase().replace(/[^A-ZÀ-Ú0-9_]/g, "_");
        return handleId === intentId || handleId.includes(intentId) || intentId.includes(handleId);
      });
      if (matchingEdge) {
        queue.push(matchingEdge.target_node_id);
      } else {
        // Fallback: try first edge or log warning
        console.log(`[intent_router] No matching edge for intent "${classifiedIntent}". Available handles: ${outEdges.map((e: any) => e.source_handle_id).join(", ")}`);
        if (outEdges.length > 0) {
          queue.push(outEdges[0].target_node_id);
        }
      }
    } else if (node.node_type === "filter") {
      const passed = execution.context[`node_${node.id}_passed`];
      const handleId = passed ? "passed" : "blocked";
      const matchingEdge = outEdges.find((e: any) => e.source_handle_id === handleId) || outEdges[0];
      if (matchingEdge) queue.push(matchingEdge.target_node_id);
    } else if (node.node_type === "router") {
      const matchingIndex = execution.context[`node_${node.id}_matching_index`];
      const handleId = matchingIndex >= 0 ? `branch_${matchingIndex}` : "fallback";
      const matchingEdge = outEdges.find((e: any) => e.source_handle_id === handleId) || outEdges.find((e: any) => e.source_handle_id === "fallback") || outEdges[0];
      if (matchingEdge) queue.push(matchingEdge.target_node_id);
    } else {
      for (const edge of outEdges) {
        queue.push(edge.target_node_id);
      }
    }
  }

  await supabase.from("automation_executions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", execution.id);
}

// Check if bot is allowed (global + lead-level) - legacy full check
async function checkBotStatus(supabase: any, organizationId: string, chatId: string): Promise<boolean> {
  return checkBotStatusConfigurable(supabase, organizationId, chatId, true, true);
}

// Configurable bot status check based on node settings
async function checkBotStatusConfigurable(
  supabase: any, organizationId: string, chatId: string,
  checkGlobal: boolean, checkLead: boolean
): Promise<boolean> {
  if (checkGlobal) {
    const { data: botSettings } = await supabase
      .from("bot_settings")
      .select("global_bot_enabled")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (botSettings && botSettings.global_bot_enabled === false) return false;
  }

  if (checkLead) {
    const { data: chat } = await supabase
      .from("chats")
      .select("agent_off, bot_permanently_stopped")
      .eq("id", chatId)
      .maybeSingle();
    if (chat?.bot_permanently_stopped === true) return false;
    if (chat?.agent_off === true) return false;
  }

  return true;
}

async function resolveVariables(supabase: any, chatId: string, organizationId: string): Promise<Record<string, string>> {
  const vars: Record<string, string> = {};

  // Get chat info
  const { data: chat } = await supabase
    .from("chats")
    .select("phone, custom_name, wa_name")
    .eq("id", chatId)
    .maybeSingle();

  if (chat) {
    vars.nome = chat.custom_name || chat.wa_name || chat.phone || "";
    vars.telefone = chat.phone || "";
  }

  // Get custom field values
  const { data: fieldValues } = await supabase
    .from("chat_custom_field_values")
    .select("value, field_id")
    .eq("chat_id", chatId)
    .eq("organization_id", organizationId);

  if (fieldValues && fieldValues.length > 0) {
    const fieldIds = fieldValues.map((fv: any) => fv.field_id);
    const { data: fields } = await supabase
      .from("chat_custom_fields")
      .select("id, field_key")
      .in("id", fieldIds);

    const fieldMap = new Map((fields || []).map((f: any) => [f.id, f.field_key]));
    for (const fv of fieldValues) {
      const key = fieldMap.get(fv.field_id);
      if (key && fv.value) vars[key] = fv.value;
    }
  }

  return vars;
}

function interpolateText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    return vars[key.trim()] ?? match;
  });
}

async function executeNode(
  supabase: any,
  node: any,
  organizationId: string,
  chatId: string,
  context: any
): Promise<{ success: boolean; message?: string }> {
  const config = node.config || {};

  // Resolve variables for message interpolation
  let vars: Record<string, string> | null = null;
  const needsVars = ["send_message", "ask_question", "send_image", "send_audio", "send_document", "http_request", "capture_info", "edit_fields", "filter", "ai_agent"].includes(node.node_type);
  if (needsVars) {
    vars = await resolveVariables(supabase, chatId, organizationId);
  }

  switch (node.node_type) {
    case "trigger":
      return { success: true, message: "Trigger activated" };

    case "send_message": {
      let messageText = config.message || config.text;
      if (!messageText) return { success: true, message: "No message configured" };
      messageText = interpolateText(messageText, vars || {});

      // Insert message into DB
      const { data: insertedMsg, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          organization_id: organizationId,
          content: messageText,
          message_type: "text",
          is_from_user: true,
          sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

      if (error || !insertedMsg?.id) {
        return { success: false, message: error?.message || "Failed to create message" };
      }

      // AWAIT Evolution API to guarantee message order
      const evoRes = await supabase.functions.invoke("send-to-evolution", {
        body: { messageId: insertedMsg.id },
      });
      if (evoRes.error) {
        console.error("[automation] Evolution send failed:", evoRes.error);
      } else {
        // Add a small delay between messages in the same flow to protect order
        await new Promise(r => setTimeout(r, 2000));
      }

      return { success: true, message: `Message queued: ${messageText.substring(0, 50)}...` };
    }

    case "crm_move": {
      const { funnel_id, stage_id } = config;
      if (!funnel_id || !stage_id) return { success: true, message: "No CRM config" };

      const { data: existing } = await supabase
        .from("chat_funnel_stage")
        .select("id")
        .eq("chat_id", chatId)
        .eq("funnel_id", funnel_id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (existing) {
        await supabase.from("chat_funnel_stage")
          .update({ stage_id, moved_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("chat_funnel_stage").insert({
          chat_id: chatId,
          funnel_id,
          stage_id,
          organization_id: organizationId,
        });
      }
      return { success: true, message: `Moved to stage ${stage_id}` };
    }

    case "action": {
      const actionType = config.action_type;

      if (actionType === "add_tag" && config.tag_id) {
        await supabase.from("chat_tags").insert({
          chat_id: chatId,
          tag_id: config.tag_id,
          organization_id: organizationId,
        });
        return { success: true, message: `Tag ${config.tag_id} added` };
      }

      if (actionType === "remove_tag" && config.tag_id) {
        await supabase.from("chat_tags").delete()
          .eq("chat_id", chatId).eq("tag_id", config.tag_id).eq("organization_id", organizationId);
        return { success: true, message: `Tag ${config.tag_id} removed` };
      }

      if (actionType === "assign_agent" && config.agent_id) {
        await supabase.from("chats")
          .update({ assigned_to: config.agent_id, assigned_at: new Date().toISOString() })
          .eq("id", chatId);
        return { success: true, message: `Assigned to ${config.agent_id}` };
      }

      if (actionType === "webhook" && config.webhook_url) {
        // Fire-and-forget webhook too
        fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, organization_id: organizationId, context }),
        }).catch((e: any) => console.error("Webhook error:", e));
        return { success: true, message: `Webhook fired` };
      }

      return { success: true, message: `Action: ${actionType || "none"}` };
    }

    case "ask_question": {
      let questionText = config.question;
      const options = config.options || [];
      if (!questionText) return { success: true, message: "No question configured" };
      questionText = interpolateText(questionText, vars || {});

      let fullMessage = questionText;
      if (options.length > 0) {
        fullMessage += "\n\n" + options.map((opt: string, i: number) => `${i + 1}. ${interpolateText(opt, vars || {})}`).join("\n");
      }

      const { data: insertedQuestion, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          organization_id: organizationId,
          content: fullMessage,
          message_type: "text",
           is_from_user: true,
          sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

      if (error || !insertedQuestion?.id) {
        return { success: false, message: error?.message || "Failed to create question message" };
      }

      // AWAIT to guarantee order
      const evoQ = await supabase.functions.invoke("send-to-evolution", {
        body: { messageId: insertedQuestion.id },
      });
      if (evoQ.error) {
        console.error("[automation] Evolution question send failed:", evoQ.error);
      } else {
        // Delay for multi-part messages
        await new Promise(r => setTimeout(r, 2000));
      }

      return { success: true, message: `Question queued: ${questionText.substring(0, 50)}` };
    }

    case "send_image":
    case "send_audio":
    case "send_document": {
      let fileUrl = config.file_url;
      if (!fileUrl) return { success: true, message: "No file URL configured" };

      const mediaType = node.node_type === "send_image" ? "image"
        : node.node_type === "send_audio" ? "audio" : "document";
      const caption = config.caption || "";
      const fileName = config.file_name || "arquivo";

      // If file_url is base64, upload to Supabase Storage first
      if (fileUrl.startsWith("data:")) {
        try {
          const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const storagePath = `automation-media/${organizationId}/${crypto.randomUUID()}_${fileName}`;
            const { error: uploadError } = await supabase.storage
              .from("chat-files")
              .upload(storagePath, bytes.buffer, { contentType: mimeType, upsert: true });

            if (uploadError) {
              console.error("[automation] Storage upload failed:", uploadError);
              return { success: false, message: `Storage upload failed: ${uploadError.message}` };
            }

            const { data: publicUrlData } = supabase.storage.from("chat-files").getPublicUrl(storagePath);
            fileUrl = publicUrlData?.publicUrl || fileUrl;
            console.log("[automation] Uploaded base64 media to storage:", fileUrl);
          }
        } catch (uploadErr: any) {
          console.error("[automation] Base64 upload error:", uploadErr);
          return { success: false, message: `Base64 upload error: ${uploadErr.message}` };
        }
      }

      // Insert message into DB
      const { data: insertedMedia, error: mediaError } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          organization_id: organizationId,
          content: caption || null,
          message_type: mediaType,
          file_url: fileUrl,
          file_name: fileName,
          is_from_user: true,
          sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

      if (mediaError || !insertedMedia?.id) {
        return { success: false, message: mediaError?.message || "Failed to create media message" };
      }

      // AWAIT to guarantee order
      const evoM = await supabase.functions.invoke("send-to-evolution", {
        body: { messageId: insertedMedia.id },
      });
      if (evoM.error) console.error("[automation] Evolution media send failed:", evoM.error);

      return { success: true, message: `${mediaType} queued` };
    }

    case "http_request": {
      const {
        method = "GET",
        url,
        auth_type = "none",
        auth_config = {},
        send_headers,
        headers = [],
        headers_json,
        headers_mode = "manual",
        send_query_params,
        query_params = [],
        query_params_json,
        query_params_mode = "manual",
        send_body,
        body_mode = "fields",
        body_fields = [],
        body_json
      } = config;

      if (!url) return { success: false, message: "URL não configurada" };

      const resolvedVars = vars || {};
      const interpolatedUrl = interpolateText(url, resolvedVars);

      // Build Headers
      const requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (send_headers) {
        if (headers_mode === "json" && headers_json) {
          try {
            const jsonHeaders = JSON.parse(interpolateText(headers_json, resolvedVars));
            Object.assign(requestHeaders, jsonHeaders);
          } catch (e) { console.error("Header JSON parse error:", e); }
        } else {
          headers.forEach((h: any) => {
            if (h.name) requestHeaders[h.name] = interpolateText(h.value, resolvedVars);
          });
        }
      }

      // Auth
      if (auth_type === "bearer" && auth_config.token) {
        requestHeaders["Authorization"] = `Bearer ${interpolateText(auth_config.token, resolvedVars)}`;
      } else if (auth_type === "basic" && auth_config.username) {
        const creds = btoa(`${interpolateText(auth_config.username, resolvedVars)}:${interpolateText(auth_config.password || "", resolvedVars)}`);
        requestHeaders["Authorization"] = `Basic ${creds}`;
      } else if (auth_type === "api_key" && auth_config.key) {
        const keyName = interpolateText(auth_config.header_name || "x-api-key", resolvedVars);
        const prefix = auth_config.prefix ? interpolateText(auth_config.prefix, resolvedVars) + " " : "";
        requestHeaders[keyName] = prefix + interpolateText(auth_config.key, resolvedVars);
      }

      // Query Params
      let finalUrl = interpolatedUrl;
      if (send_query_params) {
        const urlObj = new URL(interpolatedUrl);
        if (query_params_mode === "json" && query_params_json) {
          try {
            const jsonParams = JSON.parse(interpolateText(query_params_json, resolvedVars));
            Object.entries(jsonParams).forEach(([k, v]) => urlObj.searchParams.set(k, String(v)));
          } catch (e) { console.error("Query param JSON parse error:", e); }
        } else {
          query_params.forEach((p: any) => {
            if (p.name) urlObj.searchParams.set(p.name, interpolateText(p.value, resolvedVars));
          });
        }
        finalUrl = urlObj.toString();
      }

      // Body
      let requestBody: any = null;
      if (send_body && !["GET", "HEAD"].includes(method)) {
        if (body_mode === "raw" || body_mode === "json") {
          requestBody = interpolateText(body_json, resolvedVars);
        } else {
          const bodyObj: Record<string, any> = {};
          body_fields.forEach((f: any) => {
            if (f.name) bodyObj[f.name] = interpolateText(f.value, resolvedVars);
          });
          requestBody = JSON.stringify(bodyObj);
        }
      }

      try {
        const response = await fetch(finalUrl, {
          method,
          headers: requestHeaders,
          body: requestBody,
        });

        const contentType = response.headers.get("content-type");
        let responseData: any = null;
        if (contentType?.includes("application/json")) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (context) {
          context[`node_${node.id}_response`] = responseData;
          context[`node_${node.id}_status`] = response.status;
        }

        return {
          success: response.ok,
          message: `HTTP ${response.status}`
        };
      } catch (e: any) {
        return { success: false, message: `Request failed: ${e.message}` };
      }
    }

    case "capture_info": {
      const { field_key, question } = config;
      if (!question) return { success: true, message: "Sem pergunta configurada" };

      const resolvedVars = vars || {};
      const questionText = interpolateText(question, resolvedVars);

      const { data: insertedMsg, error } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          organization_id: organizationId,
          content: questionText,
          message_type: "text",
          is_from_user: true,
          sent_from_platform: true,
        })
        .select("id")
        .maybeSingle();

      if (error || !insertedMsg?.id) return { success: false, message: error?.message || "Erro ao criar mensagem" };

      await supabase.functions.invoke("send-to-evolution", { body: { messageId: insertedMsg.id } });

      if (context) {
        context.capture_field = field_key;
      }
      return { success: true, message: `Capturando: ${field_key}` };
    }

    case "edit_fields": {
      const { mode = "manual", fields = [], json_value } = config;
      const resolvedVars = vars || {};

      if (mode === "json" && json_value) {
        try {
          const parsed = JSON.parse(interpolateText(json_value, resolvedVars));
          Object.assign(context, parsed);
        } catch (e) { console.error("Edit fields JSON parse error:", e); }
      } else {
        fields.forEach((f: any) => {
          if (f.name) {
            let val: any = interpolateText(f.value, resolvedVars);
            if (f.type === "number") val = Number(val);
            else if (f.type === "boolean") val = val === "true" || val === true;
            else if (f.type === "object" || f.type === "array") {
              try { val = JSON.parse(val); } catch { }
            }
            context[f.name] = val;
          }
        });
      }
      return { success: true, message: `Campos atualizados` };
    }

    case "code": {
      const { language = "javascript", code } = config;
      if (!code) return { success: true, message: "Sem código" };
      if (language !== "javascript") return { success: false, message: "Apenas JavaScript é suportado" };

      try {
        const fn = new Function("input", "context", code);
        const result = fn(context.last_response_data || {}, context);
        context[`node_${node.id}_output`] = result;
        return { success: true, message: "Código executado" };
      } catch (e: any) {
        return { success: false, message: `Erro no código: ${e.message}` };
      }
    }

    case "filter": {
      const { conditions = [], match_mode = "all" } = config;
      const resolvedVars = vars || {};

      const resList = conditions.map((cond: any) => {
        const fieldVal = interpolateText(cond.field, resolvedVars);
        const expectedVal = interpolateText(cond.value, resolvedVars);
        return evaluateCondition({ condition_type: cond.operator, condition_value: expectedVal }, { last_response: fieldVal });
      });

      const passed = match_mode === "all" ? resList.every((r: boolean) => r) : resList.some((r: boolean) => r);
      if (context) context[`node_${node.id}_passed`] = passed;

      return { success: true, message: passed ? "Filtro: Passou" : "Filtro: Bloqueado" };
    }

    case "condition":
      return { success: true, message: "Condition evaluated" };

    case "delay":
      return { success: true, message: `Delay: ${config.duration || 0} ${config.unit || "min"}` };

    case "wait_response":
      return { success: true, message: "Waiting for user response" };

    case "agenda": {
      // Create a calendar event for this chat
      const eventTitle = config.event_title || "Evento automático";
      const eventDesc = config.event_description || "";
      const durationMin = parseInt(config.duration || "30", 10);
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1); // Schedule 1 hour from now
      const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

      const { error: evtError } = await supabase.from("calendar_events").insert({
        organization_id: organizationId,
        chat_id: chatId,
        title: eventTitle,
        description: eventDesc,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
      });

      if (evtError) return { success: false, message: `Agenda error: ${evtError.message}` };
      return { success: true, message: `Event created: ${eventTitle}` };
    }

    case "bot_toggle": {
      const botAction = config.bot_action || "enable";
      const agentOff = botAction === "disable";
      const notifyFinished = config.notify_finished || false;

      const updateData: any = { agent_off: agentOff };
      if (notifyFinished && agentOff) {
        updateData.bot_finished_at = new Date().toISOString();
      }
      if (notifyFinished && !agentOff) {
        updateData.bot_finished_at = null;
      }

      const { error: botError } = await supabase
        .from("chats")
        .update(updateData)
        .eq("id", chatId);

      if (botError) return { success: false, message: `Bot toggle error: ${botError.message}` };
      return { success: true, message: `Bot ${agentOff ? "disabled" : "enabled"} for chat${notifyFinished ? " (notified)" : ""}` };
    }

    case "stop_bot": {
      // Permanently stop bot for this lead (like Kommo)
      const { error: stopError } = await supabase
        .from("chats")
        .update({
          agent_off: true,
          bot_permanently_stopped: true,
          bot_finished_at: new Date().toISOString()
        })
        .eq("id", chatId);

      if (stopError) return { success: false, message: `Stop bot error: ${stopError.message}` };
      return { success: true, message: "Bot permanently stopped for this lead" };
    }

    case "loop_restart": {
      // Mark the execution as completed but schedule a restart window
      const restartDelay = parseInt(config.restart_delay || "8", 10);
      const restartUnit = config.restart_unit || "hours";
      let delayMs = restartDelay * 60 * 60 * 1000; // default hours
      if (restartUnit === "minutes") delayMs = restartDelay * 60 * 1000;
      else if (restartUnit === "days") delayMs = restartDelay * 24 * 60 * 60 * 1000;

      const restartAfter = new Date(Date.now() + delayMs).toISOString();

      if (context) {
        context.loop_restart = true;
        context.restart_at = restartAfter;
      }

      return { success: true, message: `Loop restart scheduled after ${restartDelay} ${restartUnit}.` };
    }

    case "financeiro": {
      const transType = config.transaction_type || "income";
      const amount = parseFloat(config.amount || "0");
      const productName = config.product_name || "";
      const description = config.description || "Gerado por automação";

      // Get chat phone for client reference
      const { data: chatData } = await supabase
        .from("chats")
        .select("phone, wa_name, custom_name")
        .eq("id", chatId)
        .maybeSingle();

      const clientName = chatData?.custom_name || chatData?.wa_name || chatData?.phone || "Lead";

      const { error: txError } = await supabase.from("transactions").insert({
        organization_id: organizationId,
        type: transType,
        amount: amount,
        description: description,
        product_name: productName,
        client_name: clientName,
        chat_id: chatId,
        purchase_date: new Date().toISOString(),
      });

      if (txError) return { success: false, message: `Finance error: ${txError.message}` };
      return { success: true, message: `Transaction created: R$ ${amount}` };
    }

    case "ai_agent": {
      const botAllowedSingle = await checkBotStatus(supabase, organizationId, chatId);
      if (!botAllowedSingle) {
        return { success: true, message: "⚠️ Robô desativado. Nó de I.A ignorado." };
      }
      const aiProvider = config.provider || "openai";
      const credentialId = config.credential_id;
      if (!credentialId) {
        return { success: false, message: "Credencial de I.A não configurada." };
      }

      const isVittaCredential = ["vitta-openai", "vitta-gemini"].includes(credentialId);

      if (isVittaCredential) {
        const { data: tokenBal } = await supabase
          .from("organization_token_balances")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("provider", aiProvider)
          .maybeSingle();

        const remaining = (tokenBal?.total_tokens || 0) - (tokenBal?.used_tokens || 0);
        if (remaining <= 0) {
          return { success: true, message: `⚠️ Tokens esgotados. Nó de I.A ignorado.` };
        }
      }

      let userPrompt = config.prompt || "";
      if (context && typeof context === "object") {
        userPrompt = userPrompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match: string, key: string) => {
          const parts = key.trim().split(".");
          let val: any = context;
          for (const p of parts) { val = val?.[p]; }
          return val !== undefined ? String(val) : match;
        });
      }

      const { data: agentData, error: agentError } = await supabase.functions.invoke("ai-agent-execute", {
        body: {
          prompt: userPrompt,
          system_message: config.system_message || "",
          model: config.model || (aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"),
          provider: aiProvider,
          credential_id: credentialId,
          organization_id: organizationId,
          memory_key: config.memory_key || "",
          context_window_length: config.context_window_length || 5,
          temperature: config.temperature ?? 0.7,
          max_iterations: config.max_iterations || 5,
          tools: (config.tools || []).map((t: any) => {
            let params = {};
            try { params = JSON.parse(t.parameters || "{}"); } catch { }
            return { name: t.name, description: t.description, parameters: params };
          }),
          input_data: { chat_id: chatId },
        },
      });

      if (agentError) return { success: false, message: agentError.message };
      if (agentData?.error) return { success: false, message: agentData.message || agentData.error || "Erro na I.A" };

      const aiOutput = agentData?.output || "";
      const usage = agentData?.usage;

      if (isVittaCredential && usage) {
        await supabase.rpc("increment_token_usage", {
          p_organization_id: organizationId,
          p_provider: aiProvider,
          p_amount: usage.total_tokens
        });

        supabase.from("token_transactions").insert({
          organization_id: organizationId,
          provider: aiProvider,
          transaction_type: "consumption",
          amount: usage.total_tokens,
          description: `Automação AI Agent | chat ${chatId} | Tokens: ${usage.total_tokens}`,
        }).then(() => { });
      }

      if (context) {
        context.ai_agent_output = aiOutput;
        context.ai_agent_usage = usage;
      }

      const usageStr = usage ? ` | Tokens: ${usage.total_tokens}` : "";
      return { success: true, message: `AI: ${aiOutput.substring(0, 100)}...${usageStr}` };
    }

    case "router": {
      const { rules = [], mode = "rules" } = config;
      const resolvedVars = vars || {};

      let matchingIndex = -1;
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const fieldVal = interpolateText(rule.field, resolvedVars);
        const expectedVal = interpolateText(rule.value, resolvedVars);

        if (evaluateCondition({ operator: rule.operator, value: expectedVal, field: fieldVal }, resolvedVars)) {
          matchingIndex = i;
          break;
        }
      }

      if (context) context[`node_${node.id}_matching_index`] = matchingIndex;
      return { success: true, message: matchingIndex >= 0 ? `Roteado para branch ${matchingIndex + 1}` : "Nenhuma regra correspondente" };
    }

    case "intent_router": {
      // Intent Classifier: analyze recent messages and classify into one of the configured intents
      const intentInstruction = config.instruction || "Classifique a última mensagem do usuário.";
      const intents: string[] = config.intents || [];
      const contextWindowSize = config.context_window || 20;
      const intentCredentialId = config.credential_id || "vitta-openai";
      const intentModel = config.model || "gpt-4o-mini";
      const intentProvider = intentCredentialId.includes("gemini") ? "gemini" : "openai";

      if (intents.length === 0) {
        return { success: false, message: "Nenhum caminho de intenção configurado." };
      }

      // Fetch recent messages for context
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("content, is_from_user, created_at, message_type")
        .eq("chat_id", chatId)
        .eq("private", false)
        .order("created_at", { ascending: false })
        .limit(contextWindowSize);

      const chatHistory = (recentMessages || [])
        .reverse()
        .map((m: any) => {
          const sender = m.is_from_user ? "Lead" : "Atendente/Robô";
          const content = m.content || `[${m.message_type}]`;
          return `${sender}: ${content}`;
        })
        .join("\n");

      const classificationPrompt = `Analise o histórico da conversa abaixo e classifique a situação atual do lead em EXATAMENTE uma das seguintes intenções:

${intents.map((intent: string, i: number) => `${i + 1}. ${intent}`).join("\n")}

CRITÉRIOS DE DECISÃO:
${intentInstruction}

HISTÓRICO DA CONVERSA:
${chatHistory || "Sem histórico."}

RESPONDA APENAS com o nome exato da intenção que melhor se encaixa, sem explicações. Use EXATAMENTE um dos nomes listados acima.`;

      try {
        const { data: classifyResult, error: classifyError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: classificationPrompt,
            system_message: "Você é um classificador de intenções. Responda APENAS com o nome exato da intenção, sem formatação ou explicação adicional.",
            model: intentModel,
            provider: intentProvider,
            credential_id: intentCredentialId,
            organization_id: organizationId,
            memory_key: "",
            context_window_length: 0,
            temperature: 0.1,
            max_iterations: 1,
            tools: [],
            input_data: { chat_id: chatId },
          },
        });

        if (classifyError || classifyResult?.error) {
          return { success: false, message: `Erro na classificação: ${classifyError?.message || classifyResult?.message || "Erro desconhecido"}` };
        }

        const classifiedIntent = (classifyResult?.output || "").trim().toUpperCase().replace(/[^A-ZÀ-Ú0-9_\s]/g, "");
        
        // Find the best matching intent
        let matchedIntent = "";
        for (const intent of intents) {
          const intentUpper = intent.toUpperCase().replace(/[^A-ZÀ-Ú0-9_\s]/g, "");
          if (classifiedIntent.includes(intentUpper) || intentUpper.includes(classifiedIntent)) {
            matchedIntent = intent;
            break;
          }
        }

        // Fallback: try partial match
        if (!matchedIntent) {
          for (const intent of intents) {
            const words = intent.toUpperCase().split(/[\s_]+/);
            if (words.some((w: string) => classifiedIntent.includes(w) && w.length > 3)) {
              matchedIntent = intent;
              break;
            }
          }
        }

        if (context) {
          context[`node_${node.id}_classified_intent`] = matchedIntent || classifiedIntent;
        }

        // Deduct tokens
        const isVittaCred = ["vitta-openai", "vitta-gemini"].includes(intentCredentialId);
        if (isVittaCred && classifyResult?.usage?.total_tokens) {
          await supabase.rpc("increment_token_usage", {
            p_organization_id: organizationId,
            p_provider: intentProvider,
            p_amount: classifyResult.usage.total_tokens,
          });
          supabase.from("token_transactions").insert({
            organization_id: organizationId,
            provider: intentProvider,
            transaction_type: "consumption",
            amount: classifyResult.usage.total_tokens,
            description: `Classificador de Intenções | chat ${chatId}`,
          }).then(() => {});
        }

        return { success: true, message: `Intenção: ${matchedIntent || classifiedIntent} | Tokens: ${classifyResult?.usage?.total_tokens || 0}` };
      } catch (e: any) {
        return { success: false, message: `Erro no classificador: ${e.message}` };
      }
    }

    default:
      return { success: true, message: `Unknown node type: ${node.node_type}` };
  }
}

async function executeDialogueAIAgent(
  supabase: any,
  node: any,
  organizationId: string,
  chatId: string,
  context: any,
  executionId?: string
): Promise<{ success: boolean; message?: string; dialogue_ended?: boolean; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; humanize_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null }> {
  const config = node.config || {};
  const dialogueContext = context?.dialogue_context || {};
  const currentTurn = dialogueContext.current_turn || 0;
  const lastResponse = context?.last_response || "";

  // Build prompt: on first turn use configured prompt, on subsequent turns use lead's response
  let userPrompt = "";
  if (currentTurn === 0) {
    userPrompt = config.prompt || "Inicie a conversa.";
  } else {
    userPrompt = lastResponse;
  }

  // === FETCH REAL CHAT HISTORY ===
  const { data: realHistory } = await supabase
    .from("messages")
    .select("content, is_from_user, created_at, message_type")
    .eq("chat_id", chatId)
    .eq("private", false)
    .order("created_at", { ascending: false })
    .limit(15);

  const formattedHistory = (realHistory || [])
    .reverse()
    .map((m: any) => {
      const sender = m.is_from_user ? "Lead" : "Atendente/Robô";
      const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const content = m.content || `[${m.message_type}]`;
      return `[${time}] ${sender}: ${content}`;
    })
    .join("\n");

  const objective = config.dialogue_objective || "Completar a interação com o lead.";

  // === PRE-CHECK: Evaluate if lead's message already satisfies the objective BEFORE generating a response ===
  if (currentTurn > 0 && lastResponse && objective) {
    try {
      console.log(`[dialogue] Pre-checking objective before AI response generation. Lead said: "${lastResponse.substring(0, 100)}"`);
      const { data: preCheckData, error: preCheckError } = await supabase.functions.invoke("ai-agent-execute", {
        body: {
          prompt: `Analise a ÚLTIMA MENSAGEM DO LEAD e o HISTÓRICO abaixo. Determine se a intenção do lead satisfaz o objetivo configurado.

OBJETIVO: ${objective}

ÚLTIMA MENSAGEM DO LEAD: "${lastResponse}"

HISTÓRICO RECENTE:
${formattedHistory || "Sem histórico."}

Responda APENAS com uma palavra:
- "SIM" se a mensagem do lead indica que o objetivo foi atingido (ex: demonstrou interesse nos temas do objetivo, pediu informações sobre os temas, quer falar com humano, etc.)
- "NAO" se o lead ainda não demonstrou interesse nos temas do objetivo

IMPORTANTE: Se o objetivo menciona múltiplos temas separados por "ou", basta que UM deles seja satisfeito.`,
          system_message: "Você é um classificador binário. Responda APENAS 'SIM' ou 'NAO'. Nada mais.",
          model: config.model || "gpt-4o-mini",
          provider: config.provider || "openai",
          credential_id: config.credential_id,
          organization_id: organizationId,
          memory_key: "", // No memory for pre-check
          context_window_length: 0,
          temperature: 0.1,
          max_iterations: 1,
        },
      });

      if (!preCheckError && preCheckData?.output) {
        const answer = (preCheckData.output || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
        console.log(`[dialogue] Objective pre-check result: "${answer}"`);

        if (answer === "SIM" || answer.startsWith("SIM")) {
          console.log(`[dialogue] Objective PRE-DETECTED from lead message. Skipping AI response generation.`);

          // Account for pre-check token usage
          const preCheckUsage = preCheckData.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

          return {
            success: true,
            message: `Objetivo detectado na mensagem do lead (pré-verificação). Diálogo encerrado sem gerar resposta.`,
            dialogue_ended: true,
            usage: preCheckUsage,
            humanize_usage: null,
          };
        }
      }
    } catch (preErr: any) {
      console.error("[dialogue] Pre-check failed, continuing with normal flow:", preErr.message);
      // If pre-check fails, continue normally - don't block the flow
    }
  }

  // Build system message with objective-based detection (no tool call needed)
  let systemMessage = config.system_message || "";

  systemMessage += `\n\n--- MODO DIÁLOGO ---
Você está conversando com um lead via WhatsApp em modo diálogo contínuo.
OBJETIVO: ${objective}

REGRAS:
1. Converse naturalmente para alcançar o objetivo acima.
2. Analise o [HISTÓRICO REAL DA CONVERSA] abaixo antes de responder. Se um humano (Atendente) já tiver intervindo ou resolvido a dúvida do lead, NÃO repita a mesma abordagem de robô; seja breve ou encerre com [DIALOGO_CONCLUIDO] se apropriado.
3. Se o lead estiver repetindo algo que já foi respondido por um humano, reconheça isso.
4. Quando você determinar que o objetivo foi CONCLUÍDO (o lead confirmou, forneceu as informações necessárias, etc.), inclua EXATAMENTE o marcador [DIALOGO_CONCLUIDO] no FINAL da sua última mensagem (após todo o texto visível).
5. NÃO inclua [DIALOGO_CONCLUIDO] até ter certeza de que o objetivo foi realmente atingido.
6. O marcador [DIALOGO_CONCLUIDO] NÃO será enviado ao lead, é apenas um sinal interno.
7. Se o lead pedir para falar com um humano ou demonstrar insatisfação, também inclua [DIALOGO_CONCLUIDO].

[HISTÓRICO REAL DA CONVERSA (Via WhatsApp)]:
${formattedHistory || "Sem histórico prévio."}
`;

  // Always add format instruction in dialogue mode
  systemMessage += "\n\nIMPORTANTE: Separe cada parte da sua resposta usando o delimitador ⌁⌁⌁ entre cada mensagem para envio natural no WhatsApp.";

  // Prepare user tools only (no finalizar_dialogo tool)
  const userTools = (config.tools || []).map((t: any) => {
    let params = {};
    try { params = JSON.parse(t.parameters || "{}"); } catch { }
    return { name: t.name, description: t.description, parameters: params };
  });

  try {
    const { data: agentData, error: agentError } = await supabase.functions.invoke("ai-agent-execute", {
      body: {
        prompt: userPrompt,
        system_message: systemMessage,
        model: config.model || "gpt-4o-mini",
        provider: config.provider || "openai",
        credential_id: config.credential_id,
        organization_id: organizationId,
        memory_key: config.memory_key || `dialogue-${chatId}-${node.id}`,
        context_window_length: config.context_window_length || 15,
        temperature: config.temperature ?? 0.7,
        max_iterations: config.max_iterations || 5,
        tools: userTools.length > 0 ? userTools : undefined,
        input_data: { chat_id: chatId, turn: currentTurn },
      },
    });

    if (agentError) {
      return { success: false, message: agentError.message };
    }
    if (agentData?.error) {
      return { success: false, message: agentData.message || agentData.error || "Erro no Agente de Diálogo" };
    }

    let aiOutput = agentData?.output || "";

    // Detect objective completion via marker (Case insensitive and more robust)
    const dialogueEnded = aiOutput.toUpperCase().includes("[DIALOGO_CONCLUIDO]");
    // Remove the marker from the message before sending (Case insensitive)
    aiOutput = aiOutput.replace(/\[DIALOGO_CONCLUIDO\]/gi, "").trim();

    let tokenUsage = agentData?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let humanizeUsage: any = null;

    // === HUMANIZE TEXT: second AI call without memory ===
    if (config.humanize_text && aiOutput && aiOutput.trim()) {
      try {
        const shouldKeepDelimiters = aiOutput.includes("⌁⌁⌁");
        const humanizePrompt = `Reescreva o texto abaixo para parecer que foi escrito por um ser humano real conversando no WhatsApp. Regras:
1. Mantenha o mesmo significado e informações
2. Use linguagem natural e informal quando apropriado
3. Remova excessos de emoji - use apenas quando realmente necessário e natural
4. Remova formatação robótica (asteriscos excessivos, listas numeradas desnecessárias)
5. Mantenha o tom profissional mas humano
6. ${shouldKeepDelimiters ? "MANTENHA o delimitador ⌁⌁⌁ exatamente onde está para separar as mensagens" : "IMPORTANTE: Separe cada mensagem/parágrafo lógico usando o delimitador ⌁⌁⌁ entre eles. Cada segmento deve ser uma mensagem independente e natural para WhatsApp. NÃO envie tudo em um único bloco."}
7. NÃO adicione informações novas, apenas reformule
8. Cada segmento separado por ⌁⌁⌁ deve ser curto e natural (1-3 frases no máximo)

Texto original:
${aiOutput}`;

        const { data: humanData, error: humanError } = await supabase.functions.invoke("ai-agent-execute", {
          body: {
            prompt: humanizePrompt,
            system_message: "Você é um editor de texto especializado em humanizar mensagens de chatbot para WhatsApp. Reescreva o texto para soar natural e humano. SEMPRE use o delimitador ⌁⌁⌁ para separar as mensagens em partes menores e naturais.",
            model: config.model || "gpt-4o-mini",
            provider: config.provider || "openai",
            credential_id: config.credential_id,
            organization_id: organizationId,
            memory_key: "", // No memory for humanization
            context_window_length: 0,
            temperature: 0.8,
            max_iterations: 1,
            input_data: { chat_id: chatId },
          },
        });

        if (!humanError && humanData?.output) {
          aiOutput = humanData.output.trim();
          humanizeUsage = humanData.usage;
          console.log(`[dialogue] Humanized text. Original tokens: ${tokenUsage.total_tokens}, Humanize tokens: ${humanizeUsage?.total_tokens || 0}`);
        }
      } catch (hErr: any) {
        console.error("[dialogue] Humanize failed, using original:", hErr.message);
      }
    }

    // Combine token usage if humanization was used
    if (humanizeUsage) {
      const combinedTotal = tokenUsage.total_tokens + humanizeUsage.total_tokens;
      tokenUsage = {
        prompt_tokens: tokenUsage.prompt_tokens + humanizeUsage.prompt_tokens,
        completion_tokens: tokenUsage.completion_tokens + humanizeUsage.completion_tokens,
        total_tokens: combinedTotal,
      };
    }

    // Send the AI response to the lead (if there's text)
    if (aiOutput && aiOutput.trim()) {
      const AI_SPLIT_DELIMITER = "⌁⌁⌁";
      let messageParts: string[] = [aiOutput];

      if (aiOutput.includes(AI_SPLIT_DELIMITER)) {
        messageParts = aiOutput.split(AI_SPLIT_DELIMITER).map((p: string) => p.trim()).filter(Boolean);
      } else {
        const lines = aiOutput.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);
        if (lines.length > 1) messageParts = lines;
      }

      const delaySeconds = config.dialogue_delay_seconds ?? 2;

      for (let i = 0; i < messageParts.length; i++) {
        if (i > 0 && delaySeconds > 0) {
          await new Promise(r => setTimeout(r, delaySeconds * 1000));
        }

        const { data: insertedMsg, error: msgError } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            organization_id: organizationId,
            content: messageParts[i],
            message_type: "text",
            is_from_user: true,
            sent_from_platform: true,
          })
          .select("id")
          .maybeSingle();

        if (!msgError && insertedMsg?.id) {
          await supabase.functions.invoke("send-to-evolution", {
            body: { messageId: insertedMsg.id },
          });
        }
      }
    }

    // Build message with combined token info for humanize
    let turnMessage = `Turn ${currentTurn + 1} completed`;
    if (humanizeUsage) {
      const origTokens = agentData?.usage?.total_tokens || 0;
      const humTokens = humanizeUsage.total_tokens || 0;
      turnMessage += ` (humanizado: ${origTokens} + ${humTokens} = ${tokenUsage.total_tokens} tokens)`;
    }

    return { success: true, message: turnMessage, dialogue_ended: dialogueEnded, usage: tokenUsage, humanize_usage: humanizeUsage };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

function toMsFromAmountUnit(amount: string | number, unit: string, fallbackMs: number): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  if (unit === "minutes") return parsed * 60 * 1000;
  if (unit === "hours") return parsed * 60 * 60 * 1000;
  if (unit === "days") return parsed * 24 * 60 * 60 * 1000;
  return parsed * 1000;
}

async function executeFollowUpAIAgent(
  supabase: any,
  node: any,
  organizationId: string,
  chatId: string,
  context: any,
  executionId?: string
): Promise<{ success: boolean; message?: string }> {
  const config = node.config || {};

  if (!config.credential_id) {
    return { success: false, message: "Credencial de I.A não configurada no Follow Up I.A." };
  }

  const historyCount = Math.min(Math.max(parseInt(config.history_count || "20", 10), 6), 80);

  const [{ data: lastLeadMessage, error: leadErr }, { data: historyData, error: historyErr }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, created_at, content")
      .eq("chat_id", chatId)
      .eq("organization_id", organizationId)
      .eq("is_from_user", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("created_at, content, is_from_user, message_type")
      .eq("chat_id", chatId)
      .eq("organization_id", organizationId)
      .eq("private", false)
      .order("created_at", { ascending: false })
      .limit(historyCount),
  ]);

  if (leadErr) return { success: false, message: leadErr.message };
  if (historyErr) return { success: false, message: historyErr.message };

  if (!lastLeadMessage?.created_at) {
    return { success: false, message: "Não há mensagem do lead para gerar follow-up." };
  }

  const sortedHistory = [...(historyData || [])].reverse();
  const historyText = sortedHistory
    .map((m: any) => {
      const role = m.is_from_user ? "Atendente" : "Lead";
      const content = (m.content || `[${m.message_type}]`).toString().trim();
      return `[${m.created_at}] ${role}: ${content}`;
    })
    .join("\n");

  const followPrompt = config.followup_prompt || config.prompt || "Gere um follow-up curto e personalizado para reengajar este lead.";

  let systemMessage = config.system_message || "Você é um especialista em follow-up comercial via WhatsApp.";
  if (config.format_for_send !== false) {
    systemMessage += "\n\nIMPORTANTE: Separe cada parte da resposta usando EXATAMENTE o delimitador ⌁⌁⌁ entre as mensagens.";
  }

  const aiProvider = config.provider || "openai";
  const { data: agentData, error: agentError } = await supabase.functions.invoke("ai-agent-execute", {
    body: {
      prompt: `${followPrompt}\n\nÚLTIMA MENSAGEM DO LEAD (data/hora): ${lastLeadMessage.created_at}\n\nHISTÓRICO RECENTE (${historyCount} mensagens):\n${historyText}`,
      system_message: systemMessage,
      model: config.model || (aiProvider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"),
      provider: aiProvider,
      credential_id: config.credential_id,
      organization_id: organizationId,
      memory_key: "",
      context_window_length: 0,
      temperature: 0.7,
      max_iterations: 3,
      input_data: { chat_id: chatId, execution_id: executionId || null },
      enforce_vitta_token_usage: true,
    },
  });

  if (agentError) return { success: false, message: agentError.message };
  if (agentData?.error) return { success: false, message: agentData.message || agentData.error || "Erro no Follow Up I.A" };

  const aiOutput = (agentData?.output || "").trim();
  if (!aiOutput) return { success: false, message: "I.A não retornou mensagem de follow-up." };

  const parts = aiOutput.includes("⌁⌁⌁")
    ? aiOutput.split("⌁⌁⌁").map((p: string) => p.trim()).filter(Boolean)
    : aiOutput.split(/\n+/).map((p: string) => p.trim()).filter(Boolean);

  const finalParts = parts.length > 0 ? parts : [aiOutput];

  for (const part of finalParts) {
    const { data: insertedMsg, error: msgError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        organization_id: organizationId,
        content: part,
        message_type: "text",
        is_from_user: true,
        sent_from_platform: true,
      })
      .select("id")
      .maybeSingle();

    if (msgError || !insertedMsg?.id) {
      return { success: false, message: msgError?.message || "Erro ao criar mensagem de follow-up" };
    }

    await supabase.functions.invoke("send-to-evolution", {
      body: { messageId: insertedMsg.id },
    });

    // Delay between multi-part follow-up messages
    if (finalParts.indexOf(part) < finalParts.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (context && typeof context === "object") {
    context.follow_up_ai_output = aiOutput;
    context.follow_up_last_lead_message_at = lastLeadMessage.created_at;
  }

  return { success: true, message: `Follow-up gerado e enviado (${finalParts.length} parte(s))` };
}

function evaluateCondition(config: any, context: any): boolean {
  const { condition_type, condition_value, operator, value, field } = config || {};

  // Get the value to test
  let testValue = "";
  if (field) {
    // If it's a field ref, interpolate it
    testValue = field;
  } else if (context?.last_response !== undefined) {
    testValue = context.last_response;
  }

  const op = operator || condition_type;
  const expected = value || condition_value;

  const val = String(testValue || "").trim().toLowerCase();
  const exp = String(expected || "").trim().toLowerCase();

  switch (op) {
    case "equals":
    case "response_equals":
      return val === exp;
    case "not_equals":
      return val !== exp;
    case "contains":
    case "response_contains":
      return val.includes(exp);
    case "not_contains":
      return !val.includes(exp);
    case "starts_with":
      return val.startsWith(exp);
    case "ends_with":
      return val.endsWith(exp);
    case "is_empty":
      return val === "";
    case "is_not_empty":
      return val !== "";
    case "greater_than":
      return Number(val) > Number(exp);
    case "less_than":
      return Number(val) < Number(exp);
    case "regex":
      try {
        return new RegExp(expected, "i").test(testValue);
      } catch { return false; }
    case "has_tag":
      return Array.isArray(context?.tags) && context.tags.includes(expected);
    case "is_assigned":
      return !!context?.assigned_to;
    case "response_is_one_of":
    case "response_in": {
      const valuesArray = Array.isArray(config?.condition_values)
        ? config.condition_values.map((v: string) => String(v).trim().toLowerCase())
        : String(expected || "").split(",").map((v: string) => v.trim().toLowerCase());
      return valuesArray.includes(val);
    }
    default:
      return true;
  }
}
