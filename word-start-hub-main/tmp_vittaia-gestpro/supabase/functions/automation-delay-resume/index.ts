import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toMsFromAmountUnit = (amount: unknown, unit: unknown, fallbackMs: number) => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return fallbackMs;
  if (unit === "minutes") return n * 60 * 1000;
  if (unit === "hours") return n * 60 * 60 * 1000;
  if (unit === "days") return n * 24 * 60 * 60 * 1000;
  return n * 1000;
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

    // Find executions that may need resume (including old waiting_response rows with null resume_at)
    const now = new Date().toISOString();
    const { data: candidateExecutions, error } = await supabase
      .from("automation_executions")
      .select("*")
      .in("status", ["waiting", "waiting_response", "running"])
      .limit(200);

    if (error) {
      console.error("Error fetching waiting executions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!candidateExecutions || candidateExecutions.length === 0) {
      return new Response(JSON.stringify({ message: "No executions to resume", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    const nowMs = Date.now();

    for (const execution of candidateExecutions) {
      try {
        // Get the automation's nodes and edges
        const [nodesRes, edgesRes] = await Promise.all([
          supabase
            .from("automation_nodes")
            .select("*")
            .eq("automation_id", execution.automation_id)
            .eq("organization_id", execution.organization_id),
          supabase
            .from("automation_edges")
            .select("*")
            .eq("automation_id", execution.automation_id)
            .eq("organization_id", execution.organization_id),
        ]);

        const nodes = nodesRes.data || [];
        const edges = edgesRes.data || [];
        const currentNodeId = execution.current_node_id;

        if (!currentNodeId) {
          await supabase
            .from("automation_executions")
            .update({ status: "completed", completed_at: now })
            .eq("id", execution.id);
          continue;
        }

        // Status will be switched to running only when execution is actually due

        // Find edges from the current node and continue processing
        const currentNode = nodes.find((n: any) => n.id === currentNodeId);
        const outEdges = edges.filter((e: any) => e.source_node_id === currentNodeId);

        // Normalize/hydrate resume_at for waiting_response executions
        let effectiveResumeAt: string | null = execution.resume_at;
        if ((execution.status === "waiting_response" || execution.status === "running") && currentNode) {
          const cfg = currentNode.config || {};
          const isDialogueAI = currentNode.node_type === "ai_agent" && (cfg.dialogue_mode || execution.context?.dialogue_mode);
          const isAiTimeout = currentNode.node_type === "ai_agent" && (execution.context?.ai_agent_timeout_mode || cfg.timeout_enabled === true);
          const isFollowUp = currentNode.node_type === "follow_up_ai";
          const isWaitNode = currentNode.node_type === "wait_response" || currentNode.node_type === "ask_question";

          if (isDialogueAI || isAiTimeout || isFollowUp || isWaitNode) {
            const fallbackMs = isFollowUp ? 8 * 60 * 60 * 1000 : 30 * 60 * 1000;
            const defaultUnit = (currentNode.node_type === "ai_agent" || currentNode.node_type === "wait_response" || currentNode.node_type === "ask_question") ? "minutes" : "hours";
            const baseIso = execution.context?.last_response_at || execution.context?.follow_up_last_sent_at || execution.started_at;
            const baseMs = baseIso ? new Date(baseIso).getTime() : Date.now();

            const shouldHydrateMissing = !effectiveResumeAt;
            const shouldFixLegacyUnit = currentNode.node_type === "ai_agent" && !!cfg.timeout_amount && !cfg.timeout_unit;

            if ((shouldHydrateMissing || shouldFixLegacyUnit) && Number.isFinite(baseMs)) {
              const timeoutMs = toMsFromAmountUnit(cfg.timeout_amount, cfg.timeout_unit || defaultUnit, fallbackMs);
              if (timeoutMs > 0) {
                effectiveResumeAt = new Date(baseMs + timeoutMs).toISOString();
                await supabase
                  .from("automation_executions")
                  .update({ resume_at: effectiveResumeAt })
                  .eq("id", execution.id);
              }
            }
          }
        }

        const isDue = effectiveResumeAt ? new Date(effectiveResumeAt).getTime() <= nowMs : false;
        if (!isDue) {
          if (execution.status === "running" && (currentNode?.node_type === "ai_agent" || currentNode?.node_type === "follow_up_ai" || currentNode?.node_type === "wait_response" || currentNode?.node_type === "ask_question")) {
            await supabase
              .from("automation_executions")
              .update({ status: "waiting_response", resume_at: effectiveResumeAt })
              .eq("id", execution.id);
          }
          continue;
        }

        const executionStatus = (execution.status === "running" && currentNode && ["ai_agent", "follow_up_ai", "wait_response", "ask_question"].includes(currentNode.node_type))
          ? "waiting_response"
          : execution.status;

        // For response timeout, follow node-specific timeout handles
        let nextNodes: string[];
        if (executionStatus === "waiting_response" && currentNode?.node_type === "wait_response") {
          const timeoutEdge = outEdges.find((e: any) => e.source_handle_id === "timeout");
          nextNodes = timeoutEdge ? [timeoutEdge.target_node_id] : outEdges.map((e: any) => e.target_node_id);
        } else if (executionStatus === "waiting_response" && currentNode?.node_type === "follow_up_ai") {
          const timeoutEdge = outEdges.find((e: any) => e.source_handle_id === "not_responded");
          nextNodes = timeoutEdge ? [timeoutEdge.target_node_id] : outEdges.map((e: any) => e.target_node_id);
        } else if (executionStatus === "waiting_response" && currentNode?.node_type === "ai_agent") {
          const timeoutEdge = outEdges.find((e: any) => e.source_handle_id === "timeout");
          nextNodes = timeoutEdge ? [timeoutEdge.target_node_id] : outEdges.map((e: any) => e.target_node_id);
        } else {
          nextNodes = outEdges.map((e: any) => e.target_node_id);
        }
        
        if (nextNodes.length === 0) {
          await supabase
            .from("automation_executions")
            .update({ status: "completed", completed_at: now })
            .eq("id", execution.id);
          results.push({ execution_id: execution.id, status: "completed_no_next" });
          continue;
        }

        // Mark as running right before resume invocation
        await supabase
          .from("automation_executions")
          .update({ status: "running", resume_at: null })
          .eq("id", execution.id);

        // Resume by invoking the main executor with a special resume payload
        await supabase.functions.invoke("automation-executor", {
          body: {
            resume_execution_id: execution.id,
            trigger_type: "resume",
            chat_id: execution.chat_id,
            organization_id: execution.organization_id,
            start_from_nodes: nextNodes,
          },
        });

        results.push({ execution_id: execution.id, status: "resumed" });
      } catch (err: any) {
        console.error(`Error resuming execution ${execution.id}:`, err);
        await supabase
          .from("automation_executions")
          .update({ status: "failed", completed_at: now })
          .eq("id", execution.id);
        results.push({ execution_id: execution.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ resumed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Delay resume error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
