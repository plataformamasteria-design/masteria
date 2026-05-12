// Centralized tag deletion routine.
// Tags are referenced by multiple tables via foreign keys.
// If we delete a tag without cleaning dependencies, Postgres will reject the delete.

type SupabaseLike = {
  from: (table: string) => any;
};

export async function deleteTagWithCleanup(params: {
  supabase: SupabaseLike;
  tagId: string;
  organizationId: string;
}) {
  const { supabase, tagId, organizationId } = params;

  // 1) Unlink from analytics configuration – only nullify columns that actually reference this tag.
  // First fetch current config to know which columns to clear.
  const { data: configs } = await supabase
    .from('analytics_config')
    .select('id, conversion_start_tag_id, conversion_end_tag_id, sales_cycle_start_tag_id, sales_cycle_end_tag_id')
    .eq('organization_id', organizationId)
    .or(
      [
        `conversion_start_tag_id.eq.${tagId}`,
        `conversion_end_tag_id.eq.${tagId}`,
        `sales_cycle_start_tag_id.eq.${tagId}`,
        `sales_cycle_end_tag_id.eq.${tagId}`,
      ].join(',')
    );

  if (configs && configs.length > 0) {
    for (const cfg of configs) {
      const patch: Record<string, null> = {};
      if (cfg.conversion_start_tag_id === tagId) patch.conversion_start_tag_id = null;
      if (cfg.conversion_end_tag_id === tagId) patch.conversion_end_tag_id = null;
      if (cfg.sales_cycle_start_tag_id === tagId) patch.sales_cycle_start_tag_id = null;
      if (cfg.sales_cycle_end_tag_id === tagId) patch.sales_cycle_end_tag_id = null;
      if (Object.keys(patch).length > 0) {
        await supabase.from('analytics_config').update(patch).eq('id', cfg.id);
      }
    }
  }

  // 2) Remove chat-tag relations & history
  await supabase.from('chat_tags').delete().eq('tag_id', tagId);
  await supabase.from('chat_tags_history').delete().eq('tag_id', tagId);

  // 3) Remove follow-up references
  await supabase.from('follow_up_steps').delete().eq('tag_id', tagId);
  await supabase.from('follow_up_sequence_triggers').delete().eq('trigger_tag_id', tagId);

  // 4) Finally delete the tag
  const { error } = await supabase.from('tags').delete().eq('id', tagId);
  if (error) throw error;
}
