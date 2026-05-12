import { supabase } from "@/integrations/supabase/client";

export interface ExportedAutomation {
  _format: "vitta-automation-v1";
  name: string;
  description: string | null;
  trigger_type: string;
  schedule_config: any;
  nodes: Array<{
    temp_id: string;
    node_type: string;
    label: string | null;
    config: any;
    position_x: number;
    position_y: number;
  }>;
  edges: Array<{
    source_temp_id: string;
    target_temp_id: string;
    source_handle_id: string | null;
    condition_label: string | null;
    condition_value: string | null;
  }>;
  exported_at: string;
}

export async function exportAutomation(automationId: string): Promise<ExportedAutomation | null> {
  const [autoRes, nodesRes, edgesRes] = await Promise.all([
    (supabase as any).from("automations").select("*").eq("id", automationId).single(),
    (supabase as any).from("automation_nodes").select("*").eq("automation_id", automationId),
    (supabase as any).from("automation_edges").select("*").eq("automation_id", automationId),
  ]);

  if (autoRes.error || !autoRes.data) return null;

  const automation = autoRes.data;
  const nodes = nodesRes.data || [];
  const edges = edgesRes.data || [];

  // Map real IDs to temp IDs
  const idMap: Record<string, string> = {};
  const exportNodes = nodes.map((n: any, i: number) => {
    const tempId = `node-${i}`;
    idMap[n.id] = tempId;
    return {
      temp_id: tempId,
      node_type: n.node_type,
      label: n.label,
      config: n.config,
      position_x: n.position_x,
      position_y: n.position_y,
    };
  });

  const exportEdges = edges
    .filter((e: any) => idMap[e.source_node_id] && idMap[e.target_node_id])
    .map((e: any) => ({
      source_temp_id: idMap[e.source_node_id],
      target_temp_id: idMap[e.target_node_id],
      source_handle_id: e.source_handle_id,
      condition_label: e.condition_label,
      condition_value: e.condition_value,
    }));

  return {
    _format: "vitta-automation-v1",
    name: automation.name,
    description: automation.description,
    trigger_type: automation.trigger_type,
    schedule_config: automation.schedule_config,
    nodes: exportNodes,
    edges: exportEdges,
    exported_at: new Date().toISOString(),
  };
}

export function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importPlatformAutomation(
  data: ExportedAutomation,
  organizationId: string,
  name: string,
  userId?: string
): Promise<string> {
  const { data: automation, error: autoErr } = await (supabase as any)
    .from("automations")
    .insert({
      name,
      description: data.description || `Importada em ${new Date().toLocaleDateString("pt-BR")}`,
      trigger_type: data.trigger_type || "manual",
      organization_id: organizationId,
      schedule_config: data.schedule_config,
      created_by: userId || null,
    })
    .select("id")
    .single();

  if (autoErr) throw autoErr;
  const automationId = automation.id;

  // Map temp IDs to real UUIDs
  const tempToReal: Record<string, string> = {};
  const allNodes = data.nodes.map((n) => {
    const realId = crypto.randomUUID();
    tempToReal[n.temp_id] = realId;
    return {
      id: realId,
      automation_id: automationId,
      organization_id: organizationId,
      node_type: n.node_type,
      label: n.label,
      config: n.config || {},
      position_x: n.position_x,
      position_y: n.position_y,
    };
  });

  if (allNodes.length > 0) {
    const { error: nodesErr } = await (supabase as any).from("automation_nodes").insert(allNodes);
    if (nodesErr) throw nodesErr;
  }

  const allEdges = data.edges
    .filter((e) => tempToReal[e.source_temp_id] && tempToReal[e.target_temp_id])
    .map((e) => ({
      id: crypto.randomUUID(),
      automation_id: automationId,
      organization_id: organizationId,
      source_node_id: tempToReal[e.source_temp_id],
      target_node_id: tempToReal[e.target_temp_id],
      source_handle_id: e.source_handle_id,
      condition_label: e.condition_label,
      condition_value: e.condition_value,
    }));

  if (allEdges.length > 0) {
    const { error: edgesErr } = await (supabase as any).from("automation_edges").insert(allEdges);
    if (edgesErr) throw edgesErr;
  }

  return automationId;
}
