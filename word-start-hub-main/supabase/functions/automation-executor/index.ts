import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/r2-client.ts";
import { handleSendMessage, handleAskQuestion, handleSendToNumber } from "./handlers/messages.ts";
import { handleCrmMove, handleAction, handleBotToggle } from "./handlers/crm.ts";
import { handleSendMedia } from "./handlers/media.ts";
import { handleHttpRequest } from "./handlers/http.ts";
import { handleEditFields, handleCaptureInfo, handleCode, handleFilter, handleRouter, handleLoopRestart, handleStopBot } from "./handlers/logic.ts";
import { handleAiAgent, handleIntentRouter, handleSendAiResponse } from "./handlers/ai.ts";
import { handleMarketingData, handleWaLists, handleSendMetaTemplate, handleFinanceiro, handleAgenda } from "./handlers/business.ts";
import { resolveVariables, interpolateText, invokeWithRetry } from "./utils/shared.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let jobId: string | null = null;
  let supabase: any = null;

  try {
    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    let payload = body;

    // --- BACKGROUND JOB DISPATCHER ---
    if (body.background_job_id) {
      const { data: job } = await supabase.from("automation_background_jobs").select("*").eq("id", body.background_job_id).single();
      console.log("[executor] Background job lookup:", body.background_job_id, "found:", !!job, "type:", job?.job_type, "status:", job?.status);

      if (job && (job.job_type === "trigger_automation" || job.job_type === "resume_automation")) {
        payload = job.payload;
        jobId = job.id;
        console.log("[executor] Processing trigger/resume job. Payload:", JSON.stringify(payload));

        await supabase.from("automation_background_jobs")
          .update({ status: "processing", started_at: new Date().toISOString() })
          .eq("id", job.id);
      } else {
        console.log("[executor] Routing to legacy processBackgroundJob for type:", job?.job_type);
        await processBackgroundJob(supabase, body.background_job_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // --- SIMULATOR: Real intent classification ---
    if (body.classify_intent && body.chat_id && body.organization_id) {
      const simConfig = body.config || {};
      const credentialId = simConfig.credential_id || "vitta-openai";
      const model = simConfig.model || "gpt-4o-mini";
      const instruction = simConfig.instruction || "Classifique a intenção.";
      const intents = simConfig.intents || [];
      const contextWindow = simConfig.context_window || 20;

      // Fetch recent messages
      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("content, is_from_user, message_type")
        .eq("chat_id", body.chat_id)
        .order("created_at", { ascending: false })
        .limit(contextWindow);

      const msgHistory = (recentMsgs || []).reverse().map((m: any) => ({
        role: m.is_from_user ? "assistant" : "user",
        content: m.content || "(mídia)",
      }));

      // Resolve API key
      let apiKey = "";
      if (credentialId === "vitta-openai") {
        const { data: gConfig } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
        apiKey = gConfig?.value || "";
      } else {
        const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key").eq("id", credentialId).single();
        apiKey = cred?.api_key || "";
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ intent: "OUTROS", total_tokens: 0, error: "No API key" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = instruction + "\n\nResposta DEVE ser APENAS uma das categorias: " + intents.join(", ") + ", OUTROS\nSem explicações.";
      const openaiBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...msgHistory,
          { role: "user", content: "Qual a intenção da última mensagem do usuário?" },
        ],
        max_tokens: 50,
        temperature: 0.1,
      };

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody),
      });
      const aiData = await aiResp.json();
      const rawIntent = aiData?.choices?.[0]?.message?.content?.trim().toUpperCase().replace(/[^A-ZÀ-Ú0-9_/\s]/g, "") || "OUTROS";
      const totalTokens = aiData?.usage?.total_tokens || 0;

      // Match to closest intent
      let matchedIntent = "OUTROS";
      for (const intent of intents) {
        if (rawIntent.includes(intent.toUpperCase())) {
          matchedIntent = intent;
          break;
        }
      }

      return new Response(JSON.stringify({ intent: matchedIntent, total_tokens: totalTokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SIMULATOR: Real AI agent response ---
    if (body.simulate_ai_node && body.chat_id && body.organization_id) {
      const simConfig = body.config || {};
      const credentialId = simConfig.credential_id || "vitta-openai";
      const model = simConfig.model || "gpt-4o-mini";
      const systemMessage = simConfig.system_message || simConfig.prompt || "Responda como assistente.";
      const contextWindow = simConfig.context_window || 20;

      const { data: recentMsgs } = await supabase
        .from("messages")
        .select("content, is_from_user, message_type")
        .eq("chat_id", body.chat_id)
        .order("created_at", { ascending: false })
        .limit(contextWindow);

      const msgHistory = (recentMsgs || []).reverse().map((m: any) => ({
        role: m.is_from_user ? "assistant" : "user",
        content: m.content || "(mídia)",
      }));

      let apiKey = "";
      if (credentialId === "vitta-openai") {
        const { data: gConfig } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
        apiKey = gConfig?.value || "";
      } else {
        const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key").eq("id", credentialId).single();
        apiKey = cred?.api_key || "";
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ response: "[Sem API key configurada]", total_tokens: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiBody = {
        model,
        messages: [
          { role: "system", content: systemMessage },
          ...msgHistory,
        ],
        max_tokens: 500,
        temperature: 0.7,
      };

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody),
      });
      const aiData = await aiResp.json();
      const responseText = aiData?.choices?.[0]?.message?.content || "(sem resposta)";
      const totalTokens = aiData?.usage?.total_tokens || 0;

      return new Response(JSON.stringify({ response: responseText, total_tokens: totalTokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SIMULATOR: Virtual intent classification (in-memory history, no DB read) ---
    if (body.classify_intent_virtual && body.organization_id) {
      const simConfig = body.config || {};
      const credentialId = simConfig.credential_id || "vitta-openai";
      const model = simConfig.model || "gpt-4o-mini";
      const instruction = simConfig.instruction || "Classifique a intenção.";
      const intents = simConfig.intents || [];
      const virtualHistory = body.virtual_history || [];

      let apiKey = "";
      if (credentialId === "vitta-openai") {
        const { data: gConfig } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
        apiKey = gConfig?.value || "";
      } else {
        const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key").eq("id", credentialId).single();
        apiKey = cred?.api_key || "";
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ intent: "OUTROS", total_tokens: 0, error: "No API key" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = instruction + "\n\nResposta DEVE ser APENAS uma das categorias: " + intents.join(", ") + ", OUTROS\nSem explicações.";
      const openaiBody = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...virtualHistory,
          { role: "user", content: "Qual a intenção da última mensagem do usuário?" },
        ],
        max_tokens: 50,
        temperature: 0.1,
      };

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody),
      });
      const aiData = await aiResp.json();
      const rawIntent = (aiData?.choices?.[0]?.message?.content || "OUTROS").trim().toUpperCase().replace(/[^A-ZÀ-Ú0-9_/\s]/g, "");
      const totalTokens = aiData?.usage?.total_tokens || 0;

      let matchedIntent = "";
      // Match to closest intent
      for (const intent of intents) {
        const intentUpper = intent.toUpperCase().replace(/[^A-ZÀ-Ú0-9_/\s]/g, "");
        if (rawIntent.includes(intentUpper) || intentUpper.includes(rawIntent)) {
          matchedIntent = intent;
          break;
        }
      }

      // Fallback: partial word match
      if (!matchedIntent) {
        for (const intent of intents) {
          const words = intent.toUpperCase().split(/[\s_]+/);
          if (words.some((w: string) => rawIntent.includes(w) && w.length > 3)) {
            matchedIntent = intent;
            break;
          }
        }
      }

      return new Response(JSON.stringify({ intent: matchedIntent || rawIntent, total_tokens: totalTokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SIMULATOR: Virtual AI agent (in-memory history, no DB read) ---
    if (body.simulate_ai_virtual && body.organization_id) {
      const simConfig = body.config || {};
      const credentialId = simConfig.credential_id || "vitta-openai";
      const model = simConfig.model || "gpt-4o-mini";
      let systemMessage = simConfig.system_message || simConfig.prompt || "Responda como assistente.";
      const virtualHistory = body.virtual_history || [];

      if (simConfig.format_for_send !== false) {
        systemMessage += "\n\nIMPORTANTE: Separe cada parte da resposta usando EXATAMENTE o delimitador ⌁⌁⌁ entre as mensagens.";
      }

      let apiKey = "";
      if (credentialId === "vitta-openai") {
        const { data: gConfig } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
        apiKey = gConfig?.value || "";
      } else {
        const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key").eq("id", credentialId).single();
        apiKey = cred?.api_key || "";
      }

      if (!apiKey) {
        return new Response(JSON.stringify({ response: "[Sem API key configurada]", total_tokens: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const openaiBody = {
        model,
        messages: [
          { role: "system", content: systemMessage },
          ...virtualHistory,
        ],
        max_tokens: simConfig.max_tokens || 500,
        temperature: simConfig.temperature || 0.7,
      };

      const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody),
      });
      const aiData = await aiResp.json();
      const responseText = aiData?.choices?.[0]?.message?.content || "(sem resposta)";
      const totalTokens = aiData?.usage?.total_tokens || 0;

      return new Response(JSON.stringify({ response: responseText, total_tokens: totalTokens }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { trigger_type, chat_id, stage_id, funnel_id, organization_id, resume_execution_id, start_from_nodes } = payload;

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
      .eq("organization_id", organization_id);

    if (trigger_type === "manual" && payload.automation_id) {
      // Manual trigger: load the specific automation directly
      query = query.eq("id", payload.automation_id);
    } else {
      query = query.eq("status", "active").eq("trigger_type", trigger_type);

      if (trigger_type === "stage_entry") {
        query = query.eq("trigger_stage_id", stage_id);
        if (funnel_id) query = query.eq("funnel_id", funnel_id);
      } else if (trigger_type === "message_received") {
        if (funnel_id) query = query.eq("funnel_id", funnel_id);
        if (stage_id) query = query.eq("trigger_stage_id", stage_id);
      }
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
      // Add a random delay to prevent concurrent webhooks from passing the deduplication check simultaneously
      const jitterMs = Math.floor(Math.random() * 1500) + 200;
      await new Promise(resolve => setTimeout(resolve, jitterMs));

      const { data: existingExec } = await supabase
        .from("automation_executions")
        .select("id, status, resume_at, context")
        .eq("automation_id", automation.id)
        .eq("chat_id", chat_id)
        .eq("organization_id", organization_id)
        .in("status", ["running", "waiting", "waiting_response", "waiting_ai", "loop_completed"])
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

      // Also check if bot is permanently stopped, assigned, or agent is explicitly off for this chat
      const { data: chatBotCheck } = await supabase
        .from("chats")
        .select("bot_permanently_stopped, agent_off, assigned_to")
        .eq("id", chat_id)
        .maybeSingle();

      if (chatBotCheck?.bot_permanently_stopped === true) {
        console.log(`Skipping automation ${automation.id} - bot permanently stopped for chat ${chat_id}`);
        results.push({ automation_id: automation.id, status: "skipped", reason: "bot_permanently_stopped" });
        continue;
      }

      // Do NOT trigger new message_received automations if an agent is handling the chat
      if (trigger_type === "message_received" && (chatBotCheck?.agent_off === true || chatBotCheck?.assigned_to !== null)) {
        console.log(`Skipping automation ${automation.id} - chat assigned to agent or agent_off is true for chat ${chat_id}`);
        results.push({ automation_id: automation.id, status: "skipped", reason: "agent_handling_chat" });
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

    if (jobId) {
      await supabase.from("automation_background_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Executor error:", error);
    if (jobId && supabase) {
      supabase.from("automation_background_jobs").update({ status: "failed", error_message: error.message }).eq("id", jobId).then();
    }
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

  const executionLogs: any[] = [];
  const flushLogs = () => {
    if (executionLogs.length > 0) {
      // Fire-and-forget batch insert
      supabase.from("automation_execution_logs").insert([...executionLogs])
        .then(({ error }: any) => { if (error) console.error("Batch log insert error:", error); });
      executionLogs.length = 0;
    }
  };

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

      // Log execution result to batch
      executionLogs.push({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: result.success ? "success" : "error",
        message: result.message || null,
      });
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
        flushLogs();
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
    } else if (node.node_type === "check_sender") {
      const configPhones = node.config?.phones || [];

      let leadPhone = execution.context?.lead_phone;
      if (!leadPhone) {
        const { data: chatData } = await supabase.from("chats").select("phone").eq("id", chatId).maybeSingle();
        if (chatData?.phone) {
          leadPhone = chatData.phone;
          execution.context = { ...execution.context, lead_phone: leadPhone };
        }
      }

      const matchFound = (configPhones as string[]).some(p => comparePhoneNumbers(leadPhone, p));

      // VIP Auto-Assign Integration
      if (matchFound && node.config?.vip_auto_assign) {
        const agentId = node.config.vip_agent_id;
        if (agentId) {
          await supabase.from("chats").update({ assigned_to: agentId }).eq("id", chatId);
        }
      }

      const handleId = matchFound ? "yes" : "no";
      const matchingEdge = outEdges.find((e: any) => e.source_handle_id === handleId) || outEdges[0];
      if (matchingEdge) queue.push(matchingEdge.target_node_id);
    } else if (node.node_type === "ab_test") {
      // A/B Test branching: route to chosen variant handle
      const chosenVariant = execution.context?.[`node_${currentNodeId}_ab_result`];
      if (chosenVariant) {
        const abEdge = outEdges.find((e: any) => e.source_handle_id === chosenVariant) || outEdges[0];
        if (abEdge) queue.push(abEdge.target_node_id);
      } else {
        if (outEdges[0]) queue.push(outEdges[0].target_node_id);
      }
    } else if (node.node_type === "business_hours") {
      const isWithin = execution.context?.[`node_${currentNodeId}_within_hours`];
      const bhHandleId = isWithin ? "yes" : "no";
      const bhEdge = outEdges.find((e: any) => e.source_handle_id === bhHandleId) || outEdges[0];
      if (bhEdge) queue.push(bhEdge.target_node_id);
    } else if (node.node_type === "check_tag") {
      const hasTag = execution.context?.[`node_${currentNodeId}_has_tag`];
      const ctHandleId = hasTag ? "yes" : "no";
      const ctEdge = outEdges.find((e: any) => e.source_handle_id === ctHandleId) || outEdges[0];
      if (ctEdge) queue.push(ctEdge.target_node_id);
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
      flushLogs();
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
      flushLogs();
      return;
    } else if (node.node_type === "ai_agent" && node.config?.dialogue_mode) {
      // === CHECK BOT STATUS based on node config toggles ===
      const requireGlobalBot = node.config.require_global_bot ?? true;
      const requireLeadBot = node.config.require_lead_bot ?? true;

      if (requireGlobalBot || requireLeadBot) {
        const botAllowed = await checkBotStatusConfigurable(supabase, organizationId, chatId, requireGlobalBot, requireLeadBot);
        if (!botAllowed) {
          console.log(`[ai_agent] Bot is disabled. Skipping AI agent node. (global_check=${requireGlobalBot}, lead_check=${requireLeadBot})`);
          executionLogs.push({
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
            executionLogs.push({
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
        executionLogs.push({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: "Credencial de I.A não configurada. Configure na aba 'Modelo' do nó Agente I.A.",
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        flushLogs();
        return;
      }

      // --- DEBOUNCE: Cancel any pending/processing background jobs for this execution+node ---
      // This ensures that when a lead sends multiple messages quickly, only the LAST job processes
      await supabase.from("automation_background_jobs")
        .update({ status: "cancelled" })
        .eq("execution_id", execution.id)
        .eq("node_id", currentNodeId)
        .in("status", ["pending", "processing"]);

      // --- DELEGATE TO BACKGROUND QUEUE ---
      const { data: newJob, error: jobError } = await supabase.from("automation_background_jobs").insert({
        organization_id: organizationId,
        execution_id: execution.id,
        node_id: currentNodeId,
        chat_id: chatId,
        job_type: "dialogue_ai",
        payload: { automation_id: execution.automation_id }
      }).select("id").single();

      if (jobError || !newJob) {
        console.error("[dialogue bg] Failed to create bg job:", jobError);
        executionLogs.push({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: "Erro ao enfileirar nó de I.A no Supabase Queue",
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        flushLogs();
        return;
      }

      await supabase.from("automation_executions").update({
        status: "waiting_ai",
        current_node_id: currentNodeId,
        context: { ...execution.context, dialogue_mode: true } // preserve state
      }).eq("id", execution.id);

      dispatchBackgroundJob(newJob.id);

      executionLogs.push({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: "⏳ I.A delegada para processamento em background livre de timeout.",
      });

      flushLogs();
      return; // Execution pauses, will be resumed by background worker


    } else if (node.node_type === "follow_up_ai") {
      const requireGlobalBot = node.config?.require_global_bot ?? true;
      const requireLeadBot = node.config?.require_lead_bot ?? true;

      if (requireGlobalBot || requireLeadBot) {
        const botAllowed = await checkBotStatusConfigurable(supabase, organizationId, chatId, requireGlobalBot, requireLeadBot);
        if (!botAllowed) {
          console.log(`[follow_up_ai] Bot is disabled. Skipping follow-up send. (global_check=${requireGlobalBot}, lead_check=${requireLeadBot})`);
          executionLogs.push({
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

      const { data: newJob, error: jobError } = await supabase.from("automation_background_jobs").insert({
        organization_id: organizationId,
        execution_id: execution.id,
        node_id: currentNodeId,
        chat_id: chatId,
        job_type: "follow_up_ai",
        payload: { automation_id: execution.automation_id }
      }).select("id").single();

      if (jobError || !newJob) {
        executionLogs.push({
          execution_id: execution.id,
          node_id: currentNodeId,
          organization_id: organizationId,
          status: "error",
          message: "Erro ao enfileirar Follow-up de I.A no Queue",
        });
        await supabase.from("automation_executions")
          .update({ status: "failed", completed_at: new Date().toISOString() })
          .eq("id", execution.id);
        flushLogs();
        return;
      }

      await supabase.from("automation_executions").update({
        status: "waiting_ai",
        current_node_id: currentNodeId,
        context: execution.context
      }).eq("id", execution.id);

      dispatchBackgroundJob(newJob.id);

      executionLogs.push({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: "⏳ Follow-Up I.A delegado para background."
      });

      flushLogs();
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
      executionLogs.push({
        execution_id: execution.id,
        node_id: currentNodeId,
        organization_id: organizationId,
        status: "success",
        message: `🔄 Loop configurado: automação reativável após ${restartDelay} ${restartUnit} (${restartAt})`,
      });

      flushLogs();
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
        flushLogs();
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

  flushLogs();
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
  let vars: Record<string, string> | null = null;
  const needsVars = ["send_message", "ask_question", "send_image", "send_audio", "send_document", "send_video", "http_request", "capture_info", "edit_fields", "filter", "ai_agent", "send_email", "internal_notification"].includes(node.node_type);
  if (needsVars) {
    vars = await resolveVariables(supabase, chatId, organizationId);
  }

  try {
    switch (node.node_type) {
      case "trigger": return { success: true, message: "Trigger activated" };
      case "send_message": return await handleSendMessage(supabase, config, organizationId, chatId, vars);
      case "send_to_number": return await handleSendToNumber(supabase, config, organizationId, chatId, vars, context);
      case "ask_question": return await handleAskQuestion(supabase, config, organizationId, chatId, vars);
      case "send_image":
      case "send_audio":
      case "send_document":
      case "send_video": return await handleSendMedia(supabase, node.node_type, config, organizationId, chatId);
      case "crm_move": return await handleCrmMove(supabase, config, organizationId, chatId);
      case "action": return await handleAction(supabase, config, organizationId, chatId, context);
      case "bot_toggle": return await handleBotToggle(supabase, config, chatId);
      case "http_request": return await handleHttpRequest(config, context, vars, node.id);
      case "edit_fields": return await handleEditFields(config, context, vars);
      case "capture_info": return await handleCaptureInfo(supabase, config, organizationId, chatId, context, vars);
      case "code": return await handleCode(config, context, node.id);
      case "filter": return await handleFilter(config, context, vars, node.id);
      case "router": return await handleRouter(config, context, vars, node.id);
      case "loop_restart": return await handleLoopRestart(config, context);
      case "stop_bot": return await handleStopBot(supabase, chatId);
      case "ai_agent": return await handleAiAgent(supabase, config, organizationId, chatId, context, node.id);
      case "send_ai_response": return await handleSendAiResponse(supabase, config, organizationId, chatId, context);
      case "intent_router": return await handleIntentRouter(supabase, config, organizationId, chatId, context, node.id);
      case "marketing_data": return await handleMarketingData(supabase, organizationId, node.data?.label || "Marketing", context, config);
      case "wa_lists": return await handleWaLists(supabase, organizationId, context);
      case "send_meta_template": return await handleSendMetaTemplate(supabase, config, organizationId, chatId);
      case "financeiro": return await handleFinanceiro(supabase, config, organizationId, chatId);
      case "agenda": return await handleAgenda(supabase, config, organizationId, chatId);
      case "delay": return { success: true, message: "Delay handled" };
      case "wait_response": return { success: true, message: "Wait response handled" };
      case "condition": return { success: true, message: "Condition evaluated" };

      // --- NEW PLAN 1 NODES ---
      case "ab_test": {
        const variants: { name: string; weight: number }[] = config.variants || [{ name: "A", weight: 50 }, { name: "B", weight: 50 }];
        const totalWeight = variants.reduce((s: number, v: any) => s + (v.weight || 0), 0);
        const rand = Math.random() * totalWeight;
        let cumulative = 0;
        let chosen = variants[0]?.name || "A";
        for (const v of variants) {
          cumulative += v.weight || 0;
          if (rand <= cumulative) { chosen = v.name; break; }
        }
        if (context) context[`node_${node.id}_ab_result`] = chosen;
        return { success: true, message: `A/B: ${chosen}` };
      }

      case "react_message": {
        const emoji = config.emoji || "👍";
        const { data: lastMsg } = await supabase
          .from("messages").select("id, provider_message_id")
          .eq("chat_id", chatId).eq("is_from_user", false)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lastMsg?.id) {
          await invokeWithRetry(supabase, "send-to-evolution", {
            body: { messageId: lastMsg.id, reaction: emoji },
          });
        }
        return { success: true, message: `Reacted with ${emoji}` };
      }

      case "send_email": {
        const resolvedVars = vars || {};
        const emailTo = interpolateText(config.to || "", resolvedVars);
        const emailSubject = interpolateText(config.subject || "", resolvedVars);
        const emailBody = interpolateText(config.body || "", resolvedVars);
        if (!emailTo) return { success: false, message: "Destinatário de e-mail vazio" };
        const emailRes = await invokeWithRetry(supabase, "email-api", {
          body: { to: emailTo, subject: emailSubject, html: emailBody },
        });
        if (emailRes?.error) return { success: false, message: `Email error: ${emailRes.error.message || emailRes.error}` };
        return { success: true, message: `E-mail enviado para ${emailTo}` };
      }

      case "internal_notification": {
        const resolvedVars = vars || {};
        const notifMessage = interpolateText(config.message || "Alerta da automação", resolvedVars);
        const notifyAll = config.notify_all ?? true;
        const agentId = config.agent_id;
        await supabase.from("messages").insert({
          chat_id: chatId, organization_id: organizationId,
          content: `🔔 [Notificação Interna] ${notifMessage}`,
          message_type: "system", is_from_user: false, sent_from_platform: true,
        });
        return { success: true, message: `Notificação interna enviada${notifyAll ? " (equipe toda)" : ` (agente: ${agentId})`}` };
      }

      case "business_hours": {
        const startTime = config.start_time || "08:00";
        const endTime = config.end_time || "18:00";
        const activeDays: string[] = config.active_days || ["mon", "tue", "wed", "thu", "fri"];
        const now = new Date();
        const brTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
        const dayMap: Record<number, string> = { 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };
        const currentDay = dayMap[brTime.getDay()];
        const currentMinutes = brTime.getHours() * 60 + brTime.getMinutes();
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const isWithin = activeDays.includes(currentDay) && currentMinutes >= startMin && currentMinutes <= endMin;
        if (context) context[`node_${node.id}_within_hours`] = isWithin;
        return { success: true, message: isWithin ? "Dentro do horário" : "Fora do horário" };
      }

      case "check_tag": {
        const tagId = config.tag_id;
        if (!tagId) return { success: true, message: "Tag não configurada" };
        const { data: tagEntry } = await supabase
          .from("chat_tags").select("id")
          .eq("chat_id", chatId).eq("tag_id", tagId).eq("organization_id", organizationId)
          .maybeSingle();
        const hasTag = !!tagEntry;
        if (context) context[`node_${node.id}_has_tag`] = hasTag;
        return { success: true, message: hasTag ? "Lead tem a tag" : "Lead NÃO tem a tag" };
      }

      default:
        return { success: true, message: `Unknown node type: ${node.node_type}` };
    }
  } catch (e: any) {
    console.error(`[executeNode] Fatal error on node ${node.node_type}:`, e);
    return { success: false, message: e.message || "Unknown execution error" };
  }
}

async function transcribeAudio(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
  try {
    let apiKey = "";
    if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
      const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
      if (!globalCfg?.value) return null;
      apiKey = globalCfg.value;
    } else {
      const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
      if (!cred || cred.provider !== "openai") return null;
      apiKey = cred.api_key;
    }

    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    const audioBlob = await response.blob();

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!whisperRes.ok) return null;

    const result = await whisperRes.json();
    return result.text || null;
  } catch (e) {
    console.error("[dialogue] Transcribe error:", e);
    return null;
  }
}

async function describeImage(fileUrl: string, credentialId: string, organizationId: string, supabase: any): Promise<string | null> {
  try {
    let apiKey = "";
    if (credentialId === "vitta-openai" || credentialId === "vitta-gemini") {
      const { data: globalCfg } = await supabase.from("global_config").select("value").eq("key", "openai_api_key").single();
      if (!globalCfg?.value) return null;
      apiKey = globalCfg.value;
    } else {
      const { data: cred } = await supabase.from("ai_agent_credentials").select("api_key, provider").eq("id", credentialId).eq("organization_id", organizationId).single();
      if (!cred) return null;
      apiKey = cred.api_key;
    }

    // Use GPT-4o-mini vision to describe the image
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Descreva detalhadamente o conteúdo desta imagem em português. Se houver texto na imagem, transcreva-o. Se for um print de conversa, transcreva o conteúdo. Se for um documento, extraia as informações. Seja objetivo e completo."
              },
              {
                type: "image_url",
                image_url: { url: fileUrl, detail: "high" }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`[dialogue] Vision API error: ${response.status} ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("[dialogue] Image describe error:", e);
    return null;
  }
}

async function extractPdfText(fileUrl: string): Promise<string | null> {
  try {
    // Fetch the PDF file
    const response = await fetch(fileUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Simple PDF text extraction - parse text objects from PDF stream
    // This avoids using AI tokens entirely
    const text = new TextDecoder("latin1").decode(bytes);
    const extractedParts: string[] = [];

    // Extract text between BT (begin text) and ET (end text) markers
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(text)) !== null) {
      const block = match[1];
      // Find text strings in Tj and TJ operators
      const tjRegex = /\(([^)]*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const decoded = tjMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (decoded.trim()) extractedParts.push(decoded);
      }

      // Also handle TJ arrays: [(text) -kern (text)] TJ
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrMatch;
      while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
        const arrContent = tjArrMatch[1];
        const strRegex = /\(([^)]*)\)/g;
        let strMatch;
        let line = "";
        while ((strMatch = strRegex.exec(arrContent)) !== null) {
          line += strMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")")
            .replace(/\\\\/g, "\\");
        }
        if (line.trim()) extractedParts.push(line);
      }
    }

    if (extractedParts.length === 0) {
      // Fallback: try to find readable text sequences
      const readableRegex = /[\x20-\x7E\xC0-\xFF]{20,}/g;
      let readable;
      while ((readable = readableRegex.exec(text)) !== null) {
        extractedParts.push(readable[0]);
      }
    }

    const result = extractedParts.join(" ").replace(/\s+/g, " ").trim();
    return result.length > 0 ? result.substring(0, 5000) : null; // Limit to 5000 chars
  } catch (e) {
    console.error("[dialogue] PDF extract error:", e);
    return null;
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

  // === FETCH REAL CHAT HISTORY ===
  const historyLimit = config.context_window_length || 15;
  const { data: realHistory } = await supabase
    .from("messages")
    .select("id, content, is_from_user, created_at, message_type, file_url")
    .eq("chat_id", chatId)
    .eq("private", false)
    .order("created_at", { ascending: false })
    .limit(historyLimit);

  const historyArr = realHistory || [];

  // Transcribe/describe media from the lead (audio, images, PDFs)
  for (const m of historyArr) {
    if (!m.is_from_user && (!m.content || m.content.trim() === "") && m.file_url) {
      const credId = config.credential_id || "vitta-openai";

      if (m.message_type === "audio") {
        console.log(`[dialogue] Found untranscribed audio (ID: ${m.id}). Attempting transcription...`);
        const transcribedText = await transcribeAudio(m.file_url, credId, organizationId, supabase);
        if (transcribedText) {
          m.content = `[Áudio transcrito]: ${transcribedText}`;
          console.log(`[dialogue] Transcribed: ${m.content}`);
          await supabase.from("messages").update({ content: m.content }).eq("id", m.id);
        } else {
          m.content = `[Áudio não transcrito]`;
        }
      } else if (m.message_type === "image") {
        console.log(`[dialogue] Found undescribed image (ID: ${m.id}). Attempting vision description...`);
        const description = await describeImage(m.file_url, credId, organizationId, supabase);
        if (description) {
          m.content = `[Imagem descrita]: ${description}`;
          console.log(`[dialogue] Image described: ${m.content.substring(0, 100)}...`);
          await supabase.from("messages").update({ content: m.content }).eq("id", m.id);
        } else {
          m.content = `[Imagem recebida - não descrita]`;
        }
      } else if (m.message_type === "document") {
        console.log(`[dialogue] Found unextracted document (ID: ${m.id}). Attempting text extraction...`);
        const pdfText = await extractPdfText(m.file_url);
        if (pdfText) {
          m.content = `[Documento extraído]: ${pdfText}`;
          console.log(`[dialogue] Document extracted: ${pdfText.substring(0, 100)}...`);
          await supabase.from("messages").update({ content: m.content }).eq("id", m.id);
        } else {
          m.content = `[Documento recebido - não extraído]`;
        }
      }
    }
  }

  const formattedHistory = [...historyArr]
    .reverse()
    .map((m: any) => {
      const sender = m.is_from_user ? "Lead" : "Atendente/Robô";
      const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const content = m.content || `[${m.message_type}]`;
      return `[${time}] ${sender}: ${content}`;
    })
    .join("\n");

  const latestMessage = historyArr[0];
  let effectiveLastResponse = lastResponse;
  if (!effectiveLastResponse || effectiveLastResponse.trim() === "") {
    // Fallback: get the latest message from the LEAD (not bot)
    const latestLeadMsg = historyArr.find((m: any) => !m.is_from_user);
    if (latestLeadMsg) {
      effectiveLastResponse = latestLeadMsg.content || "";
    }
  }

  // Build prompt: on first turn, use configured prompt PLUS the lead's recent messages for context
  // On subsequent turns, use the lead's latest response
  let userPrompt = "";
  if (currentTurn === 0) {
    // Extract lead's recent messages to give the AI context of what was actually said
    const recentLeadMsgs = [...historyArr]
      .reverse()
      .filter((m: any) => !m.is_from_user)
      .slice(-5) // Last 5 lead messages
      .map((m: any) => m.content || `[${m.message_type}]`)
      .filter(Boolean);

    if (recentLeadMsgs.length > 0) {
      userPrompt = `${config.prompt || "Inicie a conversa."}\n\nMENSAGENS RECENTES DO LEAD (responda com base nisso):\n${recentLeadMsgs.join("\n")}`;
    } else {
      userPrompt = config.prompt || "Inicie a conversa.";
    }
  } else {
    // On subsequent turns, use the lead's latest response
    // If effectiveLastResponse is empty, try getting it from the DB
    if (!effectiveLastResponse || effectiveLastResponse.trim() === "") {
      const latestLeadFromDb = historyArr.find((m: any) => !m.is_from_user);
      effectiveLastResponse = latestLeadFromDb?.content || "Sem resposta do lead.";
    }
    userPrompt = effectiveLastResponse;
  }

  const objective = config.dialogue_objective || "Completar a interação com o lead.";

  // === PRE-CHECK: Evaluate if lead's message already satisfies the objective BEFORE generating a response ===
  if (currentTurn > 0 && effectiveLastResponse && objective) {
    try {
      console.log(`[dialogue] Pre-checking objective before AI response generation. Lead said: "${effectiveLastResponse.substring(0, 100)}"`);
      const { data: preCheckData, error: preCheckError } = await supabase.functions.invoke("ai-agent-execute", {
        body: {
          prompt: `Analise a ÚLTIMA MENSAGEM DO LEAD e o HISTÓRICO abaixo. Determine se a intenção do lead satisfaz o objetivo configurado.

OBJETIVO: ${objective}

ÚLTIMA MENSAGEM DO LEAD: "${effectiveLastResponse}"

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

    // Verify bot is still allowed to send messages (agent might have disabled it while AI was generating)
    const requireGlobalBot = config.require_global_bot ?? true;
    const requireLeadBot = config.require_lead_bot ?? true;

    // Send the AI response to the lead (if there's text)
    if (aiOutput && aiOutput.trim()) {
      if (requireGlobalBot || requireLeadBot) {
        let botAllowed = true;

        const { data: globalOrg } = await supabase
          .from("organizations")
          .select("allow_bot")
          .eq("id", organizationId)
          .maybeSingle();

        const { data: chatSettings } = await supabase
          .from("chats")
          .select("agent_off, bot_permanently_stopped, assigned_to")
          .eq("id", chatId)
          .maybeSingle();

        if (requireGlobalBot && globalOrg?.allow_bot === false) botAllowed = false;
        if (requireLeadBot && (chatSettings?.bot_permanently_stopped === true || chatSettings?.agent_off === true || chatSettings?.assigned_to !== null)) botAllowed = false;

        if (!botAllowed) {
          console.log(`[dialogue] Bot was disabled while AI was generating. Aborting message send for chat ${chatId}`);
          return {
            success: true,
            message: "⚠️ Robô foi desativado durante a geração da resposta. Mensagem abortada.",
            dialogue_ended: dialogueEnded,
            usage: tokenUsage,
            humanize_usage: humanizeUsage
          };
        }
      }

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
            sender_name: "I.A ✨",
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
      .select("id, created_at, content, is_from_user, message_type, file_url")
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

  const historyArr = historyData || [];

  // Transcribe any untranscribed audio from the lead
  for (const m of historyArr) {
    if (!m.is_from_user && m.message_type === "audio" && (!m.content || m.content.trim() === "") && m.file_url) {
      console.log(`[follow_up] Found untranscribed audio (ID: ${m.id}). Attempting transcription...`);
      const transcribedText = await transcribeAudio(m.file_url, config.credential_id || "vitta-openai", organizationId, supabase);
      if (transcribedText) {
        m.content = `[Áudio transcrito]: ${transcribedText}`;
        console.log(`[follow_up] Transcribed: ${m.content}`);
        await supabase.from("messages").update({ content: m.content }).eq("id", m.id);
      } else {
        m.content = `[Áudio não transcrito]`;
      }
    }
  }

  const sortedHistory = [...historyArr].reverse();
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

  // Stop-by-tag verification: prevent AI token usage if lead already has the specified tag
  if (config.stop_by_tag && config.stop_tag_id) {
    const { data: hasTag } = await supabase
      .from("chat_tags")
      .select("id")
      .eq("chat_id", chatId)
      .eq("tag_id", config.stop_tag_id)
      .maybeSingle();

    if (hasTag) {
      console.log(`[follow_up_ai] Lead contains block tag (${config.stop_tag_id}). Aborting follow-up generation for chat ${chatId}`);
      return { success: true, message: "🏷️ Lead possui tag de bloqueio. Follow-up concluído e envio cancelado." };
    }
  }

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

  // Verify bot is still allowed to send messages (agent might have disabled it while AI was generating)
  const requireGlobalBot = config.require_global_bot ?? true;
  const requireLeadBot = config.require_lead_bot ?? true;

  if (requireGlobalBot || requireLeadBot) {
    let botAllowed = true;

    const { data: globalOrg } = await supabase
      .from("organizations")
      .select("allow_bot")
      .eq("id", organizationId)
      .maybeSingle();

    const { data: chatSettings } = await supabase
      .from("chats")
      .select("agent_off, bot_permanently_stopped, assigned_to")
      .eq("id", chatId)
      .maybeSingle();

    if (requireGlobalBot && globalOrg?.allow_bot === false) botAllowed = false;
    if (requireLeadBot && (chatSettings?.bot_permanently_stopped === true || chatSettings?.agent_off === true || chatSettings?.assigned_to !== null)) botAllowed = false;

    if (!botAllowed) {
      console.log(`[follow_up_ai] Bot was disabled while AI was generating. Aborting follow-up send for chat ${chatId}`);
      return { success: true, message: "⚠️ Robô foi desativado durante a geração do follow-up. Mensagem abortada." };
    }
  }

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
        is_follow_up: true,
        is_from_user: true,
        sent_from_platform: true,
        sender_name: "I.A ✨"
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

function comparePhoneNumbers(phone1: string, phone2: string): boolean {
  let p1 = String(phone1 || '').replace(/\D/g, '');
  let p2 = String(phone2 || '').replace(/\D/g, '');

  if (!p1 || !p2) return false;

  if (p1.length <= 11) p1 = '55' + p1;
  if (p2.length <= 11) p2 = '55' + p2;

  if (p1.startsWith('55') && p2.startsWith('55')) {
    const ddd1 = p1.substring(2, 4);
    const num1 = p1.substring(4);
    const base1 = num1.length === 9 ? num1.substring(1) : num1;

    const ddd2 = p2.substring(2, 4);
    const num2 = p2.substring(4);
    const base2 = num2.length === 9 ? num2.substring(1) : num2;
    return ddd1 === ddd2 && base1 === base2;
  }

  return p1 === p2;
}

function evaluateCondition(config: any, context: any): boolean {
  const { condition_type, condition_value, operator, value, field, marketing_metric, marketing_operator } = config || {};

  const op = operator || condition_type;
  const expected = value || condition_value;

  if (op === "marketing_metrics") {
    const metricName = (marketing_metric || "CPL").toUpperCase();
    const targetValue = Number(expected || 0);
    const currentMetricValue = Number(context?.marketing_metrics?.[metricName] || 0);
    const mOp = marketing_operator || ">";
    switch (mOp) {
      case ">": return currentMetricValue > targetValue;
      case "<": return currentMetricValue < targetValue;
      case ">=": return currentMetricValue >= targetValue;
      case "<=": return currentMetricValue <= targetValue;
      default: return false;
    }
  }

  // Get the value to test
  let testValue = "";
  if (field) {
    // If it's a field ref, interpolate it
    testValue = field;
  } else if (context?.last_response !== undefined) {
    testValue = context.last_response;
  }

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


// --- BACKGROUND JOB HANDLING ---
function dispatchBackgroundJob(jobId: string) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/automation-executor`;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const promise = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({ background_job_id: jobId })
  }).then(res => {
    if (!res.ok) console.error("Background job dispatch failed with status:", res.status);
  }).catch(e => console.error("Background job dispatch error:", e));

  // Instruct EdgeRuntime (if available) to not kill the isolate before the request leaves
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
    (globalThis as any).EdgeRuntime.waitUntil(promise);
  }
}

async function processBackgroundJob(supabase: any, jobId: string) {
  // 1. Fetch job
  const { data: job } = await supabase.from("automation_background_jobs").select("*").eq("id", jobId).single();
  if (!job || job.status !== "pending") return;

  // 2. Mark as processing
  await supabase.from("automation_background_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

  // 3. Collect relationships
  const [{ data: execution }, { data: node }, { data: edges }] = await Promise.all([
    supabase.from("automation_executions").select("*").eq("id", job.execution_id).maybeSingle(),
    supabase.from("automation_nodes").select("*").eq("id", job.node_id).maybeSingle(),
    supabase.from("automation_edges").select("*").eq("automation_id", job.payload.automation_id).eq("organization_id", job.organization_id)
  ]);

  if (!execution || !node) {
    await supabase.from("automation_background_jobs").update({ status: "failed", error_message: "Missing execution or context" }).eq("id", jobId);
    return;
  }

  const outEdges = (edges || []).filter((e: any) => e.source_node_id === node.id);
  const executionLogs: any[] = [];
  const flushLogs = () => {
    if (executionLogs.length > 0) {
      supabase.from("automation_execution_logs").insert([...executionLogs]).then();
      executionLogs.length = 0;
    }
  };

  // 4. Heavy execution phase
  console.log(`[bg_job] Executing ${job.job_type} background task for execution ${job.execution_id}...`);
  try {
    let result;
    if (job.job_type === "dialogue_ai") {
      // DEBOUNCE: Wait before processing to allow multiple messages to accumulate
      const debounceSeconds = node.config?.debounce_seconds ?? 30;
      const debounceMs = debounceSeconds * 1000;
      if (debounceMs > 0) {
        console.log(`[bg_job] Debounce: waiting ${debounceSeconds}s for messages to accumulate...`);
        await new Promise(resolve => setTimeout(resolve, debounceMs));
        // After waiting, re-check if this job is still valid (may have been cancelled by a newer job)
        const { data: freshJob } = await supabase.from("automation_background_jobs")
          .select("status").eq("id", jobId).maybeSingle();
        if (!freshJob || freshJob.status === "cancelled") {
          console.log(`[bg_job] Job ${jobId} was cancelled during debounce (newer messages arrived). Aborting.`);
          return;
        }
        // Also re-check execution status
        const { data: freshExec } = await supabase.from("automation_executions")
          .select("status, context").eq("id", execution.id).maybeSingle();
        if (!freshExec || freshExec.status !== "waiting_ai") {
          console.log(`[bg_job] Execution ${execution.id} no longer waiting_ai after debounce. Aborting.`);
          await supabase.from("automation_background_jobs").update({ status: "cancelled" }).eq("id", jobId);
          return;
        }
        // Use the fresh context (may have been updated by newer webhook)
        execution.context = freshExec.context;
      }
      result = await executeDialogueAIAgent(supabase, node, job.organization_id, job.chat_id, execution.context, execution.id);
    } else if (job.job_type === "follow_up_ai") {
      result = await executeFollowUpAIAgent(supabase, node, job.organization_id, job.chat_id, execution.context, execution.id);
    } else {
      throw new Error("Unknown AI job type");
    }

    if (!result.success) {
      executionLogs.push({ execution_id: execution.id, node_id: node.id, organization_id: job.organization_id, status: "error", message: `Erro I.A (BgWorker): ${result.message}` });
      await supabase.from("automation_executions").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", execution.id);
      await supabase.from("automation_background_jobs").update({ status: "failed", error_message: result.message }).eq("id", jobId);
      flushLogs();
      return;
    }

    // Process output depending on type
    const nextNodes: string[] = [];
    const isVittaCredential = ["vitta-openai", "vitta-gemini"].includes(node.config?.credential_id || "");

    // Centralize token deduction for internal consistency identically to original logic
    if (isVittaCredential && result.usage && result.usage.total_tokens > 0) {
      const aiProv = node.config.provider || "openai";
      const { data: curBal } = await supabase.from("organization_token_balances").select("*").eq("organization_id", job.organization_id).eq("provider", aiProv).maybeSingle();
      if (curBal) {
        await supabase.from("organization_token_balances").update({ used_tokens: (curBal.used_tokens || 0) + result.usage.total_tokens }).eq("id", curBal.id);
      }
      supabase.from("token_transactions").insert({
        organization_id: job.organization_id, provider: aiProv, transaction_type: "consumption",
        amount: result.usage.total_tokens, description: `Automação I.A (BgWorker) | chat ${job.chat_id}`, automation_execution_id: execution.id,
      }).then();
    }

    if (job.job_type === "dialogue_ai") {
      const dialogueContext = execution.context?.dialogue_context || {};
      const currentTurn = dialogueContext.current_turn || 0;
      const maxTurns = node.config?.max_dialogue_turns || 10;
      const shouldEnd = result.dialogue_ended || (currentTurn + 1) >= maxTurns;

      let usageInfo = "";
      if (result.usage) {
        if (result.humanize_usage) {
          usageInfo = ` | Tokens: ${result.usage.total_tokens} (Geração: ${result.usage.total_tokens - result.humanize_usage.total_tokens} + Hum: ${result.humanize_usage.total_tokens})`;
        } else {
          usageInfo = ` | Tokens: ${result.usage.total_tokens}`;
        }
      }

      executionLogs.push({ execution_id: execution.id, node_id: node.id, organization_id: job.organization_id, status: "success", message: `Turn ${currentTurn + 1} completed` + usageInfo });

      if (shouldEnd) {
        console.log(`[bg_job] Ending dialogue after ${currentTurn + 1} turns.`);
        execution.context = {
          ...execution.context, dialogue_mode: false, dialogue_context: undefined,
          wait_node_id: undefined, immediate_response: undefined, last_response: undefined, last_response_at: undefined,
        };
        await supabase.from("automation_executions").update({ context: execution.context }).eq("id", execution.id);

        const completedEdge = outEdges.find((e: any) => e.source_handle_id === "completed");
        if (completedEdge) nextNodes.push(completedEdge.target_node_id);
        else nextNodes.push(...outEdges.map((e: any) => e.target_node_id));
      } else {
        const timeoutMs = toMsFromAmountUnit(node.config?.timeout_amount || "30", node.config?.timeout_unit || "minutes", 30 * 60 * 1000);
        const resumeAt = new Date(Date.now() + timeoutMs).toISOString();
        await supabase.from("automation_executions").update({
          status: "waiting_response", current_node_id: node.id, resume_at: resumeAt,
          context: {
            ...execution.context, wait_node_id: node.id, immediate_response: true, dialogue_mode: true,
            dialogue_context: { ...dialogueContext, current_turn: currentTurn + 1, node_id: node.id },
          }
        }).eq("id", execution.id);
        await supabase.from("automation_background_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);
        flushLogs();
        return;
      }
    } else if (job.job_type === "follow_up_ai") {
      const timeoutMs = toMsFromAmountUnit(node.config?.timeout_amount || "8", node.config?.timeout_unit || "hours", 8 * 60 * 60 * 1000);
      const resumeAt = new Date(Date.now() + timeoutMs).toISOString();

      executionLogs.push({
        execution_id: execution.id, node_id: node.id, organization_id: job.organization_id, status: "success",
        message: `Follow-up enviado e aguardando resposta por ${node.config?.timeout_amount || "8"} ${node.config?.timeout_unit || "hours"} (via BgWorker)`
      });

      await supabase.from("automation_executions").update({
        status: "waiting_response", current_node_id: node.id, resume_at: resumeAt,
        context: { ...execution.context, wait_node_id: node.id, immediate_response: false, follow_up_ai_mode: true, follow_up_last_sent_at: new Date().toISOString(), }
      }).eq("id", execution.id);

      await supabase.from("automation_background_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);
      flushLogs();
      return;
    }

    // Resuming flow mapping
    await supabase.from("automation_background_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);
    flushLogs();

    if (nextNodes.length > 0) {
      console.log(`[bg_job] Routing back into processFlow towards ${nextNodes.length} nodes...`);
      await processFlow(supabase, execution, [node], edges || [], job.organization_id, job.chat_id, nextNodes);
    } else {
      await supabase.from("automation_executions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", execution.id);
    }
  } catch (error: any) {
    console.error("[bg_job] Critical worker error:", error);
    await supabase.from("automation_background_jobs").update({ status: "failed", error_message: error.message }).eq("id", jobId);
  }
}
