// Temporary type definitions until Supabase types are regenerated
// This file provides manual type definitions for database tables

export interface AiPrompt {
  id: string;
  user_id: string;
  persona: string;
  script: string;
  ferramentas: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
  order_position?: number;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  phone: string;
  wa_name?: string;
  wa_photo_url?: string;
  last_message?: string;
  last_message_at?: string;
  agent_off: boolean;
  assigned_to?: string;
  team_id?: string;
  assigned_at?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  created_at: string;
  updated_at: string;
  // Group fields
  is_group: boolean;
  group_name?: string;
  group_description?: string;
  group_photo_url?: string;
  participant_count?: number;
}

export interface FollowUpSequence {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FollowUpStep {
  id: string;
  sequence_id: string;
  step_number: number;
  tag_id: string;
  delay_hours: number;
  message?: string;
  created_at: string;
}

export interface FollowUpSequenceTrigger {
  id: string;
  sequence_id: string;
  trigger_tag_id: string;
  created_at: string;
}

export interface LeadFollowUpTracking {
  id: string;
  chat_id: string;
  sequence_id: string;
  current_step: number;
  next_trigger_at: string;
  responded: boolean;
  responded_at_step?: number;
  completed: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface ChatTag {
  id: string;
  chat_id: string;
  tag_id: string;
  assigned_at: string;
}

export interface BotSettings {
  id: string;
  global_bot_enabled: boolean;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'user';
  created_at: string;
}

export interface UserPagePermission {
  id: string;
  user_id: string;
  page: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  team_members?: Array<{ team_id: string }>;
}
