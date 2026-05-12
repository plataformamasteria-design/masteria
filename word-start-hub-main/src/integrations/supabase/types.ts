export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_goals: {
        Row: {
          active: boolean | null
          created_at: string | null
          goal_type: string
          id: string
          organization_id: string
          target_value: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          goal_type: string
          id?: string
          organization_id: string
          target_value?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          goal_type?: string
          id?: string
          organization_id?: string
          target_value?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_tracking: {
        Row: {
          contacts_made: number | null
          created_at: string | null
          deals_closed: number | null
          follow_ups_sent: number | null
          id: string
          meetings_done: number | null
          messages_sent: number | null
          organization_id: string
          proposals_sent: number | null
          tracking_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          contacts_made?: number | null
          created_at?: string | null
          deals_closed?: number | null
          follow_ups_sent?: number | null
          id?: string
          meetings_done?: number | null
          messages_sent?: number | null
          organization_id: string
          proposals_sent?: number | null
          tracking_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          contacts_made?: number | null
          created_at?: string | null
          deals_closed?: number | null
          follow_ups_sent?: number | null
          id?: string
          meetings_done?: number | null
          messages_sent?: number | null
          organization_id?: string
          proposals_sent?: number | null
          tracking_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_commissions: {
        Row: {
          commission_type: string
          created_at: string | null
          fixed_value: number | null
          id: string
          organization_id: string
          percentage_value: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          commission_type?: string
          created_at?: string | null
          fixed_value?: number | null
          id?: string
          organization_id: string
          percentage_value?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          commission_type?: string
          created_at?: string | null
          fixed_value?: number | null
          id?: string
          organization_id?: string
          percentage_value?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_credentials: {
        Row: {
          api_key: string
          created_at: string
          id: string
          name: string
          organization_id: string
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_memory: {
        Row: {
          created_at: string
          id: string
          memory_key: string
          messages: Json
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_key: string
          messages?: Json
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_key?: string
          messages?: Json
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_memory_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_analysis: {
        Row: {
          analyzed_at: string | null
          chat_id: string
          clarity_score: number | null
          classification: string | null
          closing_probability: number | null
          created_at: string | null
          cta_score: number | null
          diagnosis: string | null
          followup_score: number | null
          id: string
          intent_signals: string[] | null
          lead_quality_score: number | null
          lead_quality_tier: string | null
          objection_handling_score: number | null
          objections_detected: string[] | null
          organization_id: string
          overall_score: number
          raw_analysis: Json | null
          response_time_score: number | null
          revenue_per_lead: number | null
          sale_patterns: Json | null
          sla_violations: Json | null
          strengths: string[] | null
          suggestions: string[] | null
          tone_score: number | null
          weaknesses: string[] | null
        }
        Insert: {
          analyzed_at?: string | null
          chat_id: string
          clarity_score?: number | null
          classification?: string | null
          closing_probability?: number | null
          created_at?: string | null
          cta_score?: number | null
          diagnosis?: string | null
          followup_score?: number | null
          id?: string
          intent_signals?: string[] | null
          lead_quality_score?: number | null
          lead_quality_tier?: string | null
          objection_handling_score?: number | null
          objections_detected?: string[] | null
          organization_id: string
          overall_score?: number
          raw_analysis?: Json | null
          response_time_score?: number | null
          revenue_per_lead?: number | null
          sale_patterns?: Json | null
          sla_violations?: Json | null
          strengths?: string[] | null
          suggestions?: string[] | null
          tone_score?: number | null
          weaknesses?: string[] | null
        }
        Update: {
          analyzed_at?: string | null
          chat_id?: string
          clarity_score?: number | null
          classification?: string | null
          closing_probability?: number | null
          created_at?: string | null
          cta_score?: number | null
          diagnosis?: string | null
          followup_score?: number | null
          id?: string
          intent_signals?: string[] | null
          lead_quality_score?: number | null
          lead_quality_tier?: string | null
          objection_handling_score?: number | null
          objections_detected?: string[] | null
          organization_id?: string
          overall_score?: number
          raw_analysis?: Json | null
          response_time_score?: number | null
          revenue_per_lead?: number | null
          sale_patterns?: Json | null
          sla_violations?: Json | null
          strengths?: string[] | null
          suggestions?: string[] | null
          tone_score?: number | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_analysis_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_conversation_analysis_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          action: string | null
          confidence: number | null
          created_at: string | null
          data: Json | null
          description: string
          expires_at: string | null
          id: string
          insight_type: string
          organization_id: string
          period: string | null
          reference_id: string | null
          status: string | null
          title: string
        }
        Insert: {
          action?: string | null
          confidence?: number | null
          created_at?: string | null
          data?: Json | null
          description: string
          expires_at?: string | null
          id?: string
          insight_type: string
          organization_id: string
          period?: string | null
          reference_id?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action?: string | null
          confidence?: number | null
          created_at?: string | null
          data?: Json | null
          description?: string
          expires_at?: string | null
          id?: string
          insight_type?: string
          organization_id?: string
          period?: string | null
          reference_id?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompts: {
        Row: {
          created_at: string
          ferramentas: string | null
          fields: Json | null
          id: string
          observacoes: string | null
          organization_id: string
          persona: string | null
          script: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ferramentas?: string | null
          fields?: Json | null
          id?: string
          observacoes?: string | null
          organization_id: string
          persona?: string | null
          script?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ferramentas?: string | null
          fields?: Json | null
          id?: string
          observacoes?: string | null
          organization_id?: string
          persona?: string | null
          script?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_config: {
        Row: {
          conversion_end_tag_id: string | null
          conversion_start_tag_id: string | null
          id: string
          organization_id: string
          sales_cycle_end_tag_id: string | null
          sales_cycle_start_tag_id: string | null
          updated_at: string | null
        }
        Insert: {
          conversion_end_tag_id?: string | null
          conversion_start_tag_id?: string | null
          id?: string
          organization_id: string
          sales_cycle_end_tag_id?: string | null
          sales_cycle_start_tag_id?: string | null
          updated_at?: string | null
        }
        Update: {
          conversion_end_tag_id?: string | null
          conversion_start_tag_id?: string | null
          id?: string
          organization_id?: string
          sales_cycle_end_tag_id?: string | null
          sales_cycle_start_tag_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_config_conversion_end_tag_id_fkey"
            columns: ["conversion_end_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_config_conversion_start_tag_id_fkey"
            columns: ["conversion_start_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_config_sales_cycle_end_tag_id_fkey"
            columns: ["sales_cycle_end_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_config_sales_cycle_start_tag_id_fkey"
            columns: ["sales_cycle_start_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_background_jobs: {
        Row: {
          chat_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          execution_id: string | null
          id: string
          job_type: string
          node_id: string | null
          organization_id: string
          payload: Json
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          id?: string
          job_type: string
          node_id?: string | null
          organization_id: string
          payload?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          id?: string
          job_type?: string
          node_id?: string | null
          organization_id?: string
          payload?: Json
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_background_jobs_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_background_jobs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_background_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_edges: {
        Row: {
          automation_id: string
          condition_label: string | null
          condition_value: string | null
          created_at: string
          id: string
          organization_id: string
          source_handle_id: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          automation_id: string
          condition_label?: string | null
          condition_value?: string | null
          created_at?: string
          id?: string
          organization_id: string
          source_handle_id?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          automation_id?: string
          condition_label?: string | null
          condition_value?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          source_handle_id?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_edges_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_edges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_execution_logs: {
        Row: {
          created_at: string
          execution_id: string
          id: string
          message: string | null
          node_id: string
          organization_id: string
          status: string
        }
        Insert: {
          created_at?: string
          execution_id: string
          id?: string
          message?: string | null
          node_id: string
          organization_id: string
          status?: string
        }
        Update: {
          created_at?: string
          execution_id?: string
          id?: string
          message?: string | null
          node_id?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "automation_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_execution_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_execution_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          automation_id: string
          chat_id: string
          completed_at: string | null
          context: Json
          created_at: string
          current_node_id: string | null
          id: string
          organization_id: string
          resume_at: string | null
          started_at: string
          status: string
        }
        Insert: {
          automation_id: string
          chat_id: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_node_id?: string | null
          id?: string
          organization_id: string
          resume_at?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          automation_id?: string
          chat_id?: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_node_id?: string | null
          id?: string
          organization_id?: string
          resume_at?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_node_stats: {
        Row: {
          automation_id: string
          id: string
          node_id: string
          organization_id: string
          responses: Json
          total_reached: number
          total_responded: number
          updated_at: string
        }
        Insert: {
          automation_id: string
          id?: string
          node_id: string
          organization_id: string
          responses?: Json
          total_reached?: number
          total_responded?: number
          updated_at?: string
        }
        Update: {
          automation_id?: string
          id?: string
          node_id?: string
          organization_id?: string
          responses?: Json
          total_reached?: number
          total_responded?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_node_stats_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_node_stats_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_node_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_nodes: {
        Row: {
          automation_id: string
          config: Json
          created_at: string
          id: string
          label: string | null
          node_type: string
          organization_id: string
          position_x: number
          position_y: number
        }
        Insert: {
          automation_id: string
          config?: Json
          created_at?: string
          id?: string
          label?: string | null
          node_type: string
          organization_id: string
          position_x?: number
          position_y?: number
        }
        Update: {
          automation_id?: string
          config?: Json
          created_at?: string
          id?: string
          label?: string | null
          node_type?: string
          organization_id?: string
          position_x?: number
          position_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_nodes_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_nodes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          funnel_id: string | null
          id: string
          name: string
          organization_id: string
          schedule_config: Json | null
          status: string
          trigger_stage_id: string | null
          trigger_type: string
          updated_at: string
          webhook_token: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          funnel_id?: string | null
          id?: string
          name: string
          organization_id: string
          schedule_config?: Json | null
          status?: string
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
          webhook_token?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          funnel_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          schedule_config?: Json | null
          status?: string
          trigger_stage_id?: string | null
          trigger_type?: string
          updated_at?: string
          webhook_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_trigger_stage_id_fkey"
            columns: ["trigger_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_config: {
        Row: {
          active: boolean | null
          auto_apply_tag_id: string | null
          auto_assign_agent_id: string | null
          auto_assign_funnel_id: string | null
          auto_assign_stage_id: string | null
          auto_create_chat: boolean | null
          buffer_minutes: number
          calendar_id: string | null
          created_at: string
          end_time: string
          id: string
          max_advance_days: number
          min_advance_hours: number
          organization_id: string
          primary_color: string | null
          require_email: boolean | null
          require_notes: boolean | null
          require_phone: boolean | null
          send_confirmation_webhook: boolean | null
          services: Json | null
          slot_duration_minutes: number
          start_time: string
          updated_at: string
          widget_description: string | null
          widget_title: string | null
          working_days: number[] | null
        }
        Insert: {
          active?: boolean | null
          auto_apply_tag_id?: string | null
          auto_assign_agent_id?: string | null
          auto_assign_funnel_id?: string | null
          auto_assign_stage_id?: string | null
          auto_create_chat?: boolean | null
          buffer_minutes?: number
          calendar_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          max_advance_days?: number
          min_advance_hours?: number
          organization_id: string
          primary_color?: string | null
          require_email?: boolean | null
          require_notes?: boolean | null
          require_phone?: boolean | null
          send_confirmation_webhook?: boolean | null
          services?: Json | null
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          widget_description?: string | null
          widget_title?: string | null
          working_days?: number[] | null
        }
        Update: {
          active?: boolean | null
          auto_apply_tag_id?: string | null
          auto_assign_agent_id?: string | null
          auto_assign_funnel_id?: string | null
          auto_assign_stage_id?: string | null
          auto_create_chat?: boolean | null
          buffer_minutes?: number
          calendar_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          max_advance_days?: number
          min_advance_hours?: number
          organization_id?: string
          primary_color?: string | null
          require_email?: boolean | null
          require_notes?: boolean | null
          require_phone?: boolean | null
          send_confirmation_webhook?: boolean | null
          services?: Json | null
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          widget_description?: string | null
          widget_title?: string | null
          working_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_config_auto_apply_tag_id_fkey"
            columns: ["auto_apply_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_auto_assign_agent_id_fkey"
            columns: ["auto_assign_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_auto_assign_funnel_id_fkey"
            columns: ["auto_assign_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_auto_assign_stage_id_fkey"
            columns: ["auto_assign_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          calendar_event_id: string | null
          cancellation_reason: string | null
          cancellation_token: string | null
          cancelled_at: string | null
          chat_id: string | null
          client_email: string | null
          client_name: string
          client_notes: string | null
          client_phone: string
          created_at: string
          end_time: string
          id: string
          organization_id: string
          service_name: string | null
          start_time: string
          status: string
          sync_source: string | null
          updated_at: string
        }
        Insert: {
          calendar_event_id?: string | null
          cancellation_reason?: string | null
          cancellation_token?: string | null
          cancelled_at?: string | null
          chat_id?: string | null
          client_email?: string | null
          client_name: string
          client_notes?: string | null
          client_phone: string
          created_at?: string
          end_time: string
          id?: string
          organization_id: string
          service_name?: string | null
          start_time: string
          status?: string
          sync_source?: string | null
          updated_at?: string
        }
        Update: {
          calendar_event_id?: string | null
          cancellation_reason?: string | null
          cancellation_token?: string | null
          cancelled_at?: string | null
          chat_id?: string | null
          client_email?: string | null
          client_name?: string
          client_notes?: string | null
          client_phone?: string
          created_at?: string
          end_time?: string
          id?: string
          organization_id?: string
          service_name?: string | null
          start_time?: string
          status?: string
          sync_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          global_bot_enabled: boolean
          id: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          global_bot_enabled?: boolean
          id?: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          global_bot_enabled?: boolean
          id?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          delay_seconds: number
          failed_count: number
          file_name: string | null
          file_url: string | null
          id: string
          message_content: string | null
          message_type: string
          name: string
          organization_id: string
          scheduled_at: string | null
          sent_count: number
          started_at: string | null
          status: string
          target_all_base: boolean
          target_funnel_id: string | null
          target_phones: string[] | null
          target_stage_id: string | null
          target_tag_ids: string[] | null
          target_type: string
          template_id: string | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          failed_count?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_content?: string | null
          message_type?: string
          name: string
          organization_id: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_all_base?: boolean
          target_funnel_id?: string | null
          target_phones?: string[] | null
          target_stage_id?: string | null
          target_tag_ids?: string[] | null
          target_type?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          failed_count?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_content?: string | null
          message_type?: string
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_all_base?: boolean
          target_funnel_id?: string | null
          target_phones?: string[] | null
          target_stage_id?: string | null
          target_tag_ids?: string[] | null
          target_type?: string
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_target_funnel_id_fkey"
            columns: ["target_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "broadcast_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          phone_count: number
          phones: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          phone_count?: number
          phones?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          phone_count?: number
          phones?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_message_templates: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_message_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          assigned_to: string | null
          attendance_status: string | null
          calendar_id: string | null
          chat_id: string | null
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          google_event_id: string | null
          id: string
          location: string | null
          organization_id: string
          start_time: string
          sync_source: string | null
          synced_from_google: boolean | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          all_day?: boolean | null
          assigned_to?: string | null
          attendance_status?: string | null
          calendar_id?: string | null
          chat_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          organization_id: string
          start_time: string
          sync_source?: string | null
          synced_from_google?: boolean | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          all_day?: boolean | null
          assigned_to?: string | null
          attendance_status?: string | null
          calendar_id?: string | null
          chat_id?: string | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          google_event_id?: string | null
          id?: string
          location?: string | null
          organization_id?: string
          start_time?: string
          sync_source?: string | null
          synced_from_google?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_general: boolean | null
          name: string
          order_position: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_general?: boolean | null
          name: string
          order_position?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_general?: boolean | null
          name?: string
          order_position?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendars_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_quality_scores: {
        Row: {
          analyzed_at: string | null
          campaign_id: string
          campaign_name: string | null
          contracts_from_campaign: number | null
          conversion_rate: number | null
          cost_per_qualified_lead: number | null
          created_at: string | null
          id: string
          lead_quality_avg: number | null
          meetings_from_campaign: number | null
          organization_id: string
          platform: string | null
          qualified_leads: number | null
          quality_score: number | null
          revenue_from_campaign: number | null
          show_rate: number | null
          spend: number | null
          total_leads: number | null
          true_roas: number | null
          updated_at: string | null
        }
        Insert: {
          analyzed_at?: string | null
          campaign_id: string
          campaign_name?: string | null
          contracts_from_campaign?: number | null
          conversion_rate?: number | null
          cost_per_qualified_lead?: number | null
          created_at?: string | null
          id?: string
          lead_quality_avg?: number | null
          meetings_from_campaign?: number | null
          organization_id: string
          platform?: string | null
          qualified_leads?: number | null
          quality_score?: number | null
          revenue_from_campaign?: number | null
          show_rate?: number | null
          spend?: number | null
          total_leads?: number | null
          true_roas?: number | null
          updated_at?: string | null
        }
        Update: {
          analyzed_at?: string | null
          campaign_id?: string
          campaign_name?: string | null
          contracts_from_campaign?: number | null
          conversion_rate?: number | null
          cost_per_qualified_lead?: number | null
          created_at?: string | null
          id?: string
          lead_quality_avg?: number | null
          meetings_from_campaign?: number | null
          organization_id?: string
          platform?: string | null
          qualified_leads?: number | null
          quality_score?: number | null
          revenue_from_campaign?: number | null
          show_rate?: number | null
          spend?: number | null
          total_leads?: number | null
          true_roas?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_quality_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_assignment_history: {
        Row: {
          assigned_at: string
          assigned_to: string | null
          chat_id: string
          created_at: string | null
          id: string
          organization_id: string
          team_id: string | null
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_to?: string | null
          chat_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          team_id?: string | null
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_to?: string | null
          chat_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          team_id?: string | null
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_assignment_history_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_history_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_assignment_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_custom_field_values: {
        Row: {
          chat_id: string
          field_id: string
          id: string
          organization_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          chat_id: string
          field_id: string
          id?: string
          organization_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          chat_id?: string
          field_id?: string
          id?: string
          organization_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_custom_field_values_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "chat_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_custom_field_values_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_system: boolean
          order_position: number
          organization_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          is_system?: boolean
          order_position?: number
          organization_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_system?: boolean
          order_position?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_custom_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_funnel_stage: {
        Row: {
          chat_id: string
          created_at: string
          funnel_id: string
          id: string
          moved_at: string
          organization_id: string
          stage_id: string
          sync_source: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          funnel_id: string
          id?: string
          moved_at?: string
          organization_id: string
          stage_id: string
          sync_source?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          funnel_id?: string
          id?: string
          moved_at?: string
          organization_id?: string
          stage_id?: string
          sync_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_funnel_stage_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_funnel_stage_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_funnel_stage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_funnel_stage_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          chat_id: string
          id: string
          last_seen_at: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          id?: string
          last_seen_at?: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          id?: string
          last_seen_at?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reads_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_resolutions: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          outcome: string
          resolved_at: string
          resolved_by: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          outcome: string
          resolved_at?: string
          resolved_by?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          outcome?: string
          resolved_at?: string
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_resolutions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_resolutions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_resolutions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tags: {
        Row: {
          assigned_at: string | null
          chat_id: string
          id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string | null
          chat_id: string
          id?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          assigned_at?: string | null
          chat_id?: string
          id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tags_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_tags_history: {
        Row: {
          action: string
          assigned_at: string | null
          assigned_by: string | null
          chat_id: string
          id: string
          organization_id: string
          removed_at: string | null
          tag_id: string
        }
        Insert: {
          action: string
          assigned_at?: string | null
          assigned_by?: string | null
          chat_id: string
          id?: string
          organization_id: string
          removed_at?: string | null
          tag_id: string
        }
        Update: {
          action?: string
          assigned_at?: string | null
          assigned_by?: string | null
          chat_id?: string
          id?: string
          organization_id?: string
          removed_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_tags_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_history_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_tags_history_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          agent_off: boolean
          assigned_at: string | null
          assigned_to: string | null
          bot_finished_at: string | null
          bot_permanently_stopped: boolean | null
          campaign_id: string | null
          campaign_name: string | null
          channel: string
          created_at: string
          custom_name: string | null
          group_description: string | null
          group_name: string | null
          group_photo_url: string | null
          hidden_from_chat: boolean
          human_requested_at: string | null
          id: string
          is_group: boolean
          last_away_sent_at: string | null
          last_inbound_at: string | null
          last_message: string | null
          last_message_at: string | null
          last_read_at: string | null
          last_welcome_sent_at: string | null
          name_locked: boolean | null
          organization_id: string
          participant_count: number | null
          phone: string
          resolution_outcome: string | null
          resolved_at: string | null
          resolved_by: string | null
          team_id: string | null
          transfer_requested_at: string | null
          updated_at: string
          wa_name: string | null
          wa_photo_url: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          agent_off?: boolean
          assigned_at?: string | null
          assigned_to?: string | null
          bot_finished_at?: string | null
          bot_permanently_stopped?: boolean | null
          campaign_id?: string | null
          campaign_name?: string | null
          channel?: string
          created_at?: string
          custom_name?: string | null
          group_description?: string | null
          group_name?: string | null
          group_photo_url?: string | null
          hidden_from_chat?: boolean
          human_requested_at?: string | null
          id?: string
          is_group?: boolean
          last_away_sent_at?: string | null
          last_inbound_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          last_read_at?: string | null
          last_welcome_sent_at?: string | null
          name_locked?: boolean | null
          organization_id: string
          participant_count?: number | null
          phone: string
          resolution_outcome?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          team_id?: string | null
          transfer_requested_at?: string | null
          updated_at?: string
          wa_name?: string | null
          wa_photo_url?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          agent_off?: boolean
          assigned_at?: string | null
          assigned_to?: string | null
          bot_finished_at?: string | null
          bot_permanently_stopped?: boolean | null
          campaign_id?: string | null
          campaign_name?: string | null
          channel?: string
          created_at?: string
          custom_name?: string | null
          group_description?: string | null
          group_name?: string | null
          group_photo_url?: string | null
          hidden_from_chat?: boolean
          human_requested_at?: string | null
          id?: string
          is_group?: boolean
          last_away_sent_at?: string | null
          last_inbound_at?: string | null
          last_message?: string | null
          last_message_at?: string | null
          last_read_at?: string | null
          last_welcome_sent_at?: string | null
          name_locked?: boolean | null
          organization_id?: string
          participant_count?: number | null
          phone?: string
          resolution_outcome?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          team_id?: string | null
          transfer_requested_at?: string | null
          updated_at?: string
          wa_name?: string | null
          wa_photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          chat_id: string
          client_value: number | null
          converted_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          chat_id: string
          client_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          chat_id?: string
          client_value?: number | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_benchmarks: {
        Row: {
          avg_deal_value: number | null
          avg_response_time_minutes: number | null
          coaching_tips: string[] | null
          conversion_rate: number | null
          created_at: string | null
          followup_consistency_score: number | null
          id: string
          objection_handling_score: number | null
          organization_id: string
          period: string
          rank_position: number | null
          strengths: string[] | null
          tier: string | null
          total_conversions: number | null
          total_leads: number | null
          total_revenue: number | null
          updated_at: string | null
          user_id: string
          weaknesses: string[] | null
        }
        Insert: {
          avg_deal_value?: number | null
          avg_response_time_minutes?: number | null
          coaching_tips?: string[] | null
          conversion_rate?: number | null
          created_at?: string | null
          followup_consistency_score?: number | null
          id?: string
          objection_handling_score?: number | null
          organization_id: string
          period: string
          rank_position?: number | null
          strengths?: string[] | null
          tier?: string | null
          total_conversions?: number | null
          total_leads?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          user_id: string
          weaknesses?: string[] | null
        }
        Update: {
          avg_deal_value?: number | null
          avg_response_time_minutes?: number | null
          coaching_tips?: string[] | null
          conversion_rate?: number | null
          created_at?: string | null
          followup_consistency_score?: number | null
          id?: string
          objection_handling_score?: number | null
          organization_id?: string
          period?: string
          rank_position?: number | null
          strengths?: string[] | null
          tier?: string | null
          total_conversions?: number | null
          total_leads?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          user_id?: string
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "closer_benchmarks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_benchmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_daily_metrics: {
        Row: {
          closer_id: string
          commission: number | null
          created_at: string | null
          date: string
          id: string
          ltv: number | null
          meetings_done: number | null
          meetings_scheduled: number | null
          mrr: number | null
          no_show: number | null
          organization_id: string
          sales: number | null
          updated_at: string | null
        }
        Insert: {
          closer_id: string
          commission?: number | null
          created_at?: string | null
          date: string
          id?: string
          ltv?: number | null
          meetings_done?: number | null
          meetings_scheduled?: number | null
          mrr?: number | null
          no_show?: number | null
          organization_id: string
          sales?: number | null
          updated_at?: string | null
        }
        Update: {
          closer_id?: string
          commission?: number | null
          created_at?: string | null
          date?: string
          id?: string
          ltv?: number | null
          meetings_done?: number | null
          meetings_scheduled?: number | null
          mrr?: number | null
          no_show?: number | null
          organization_id?: string
          sales?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closer_daily_metrics_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closer_daily_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_forecasts: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          model_inputs: Json | null
          organization_id: string
          predicted_churn: number | null
          predicted_new_clients: number | null
          predicted_revenue: number | null
          reference_month: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          model_inputs?: Json | null
          organization_id: string
          predicted_churn?: number | null
          predicted_new_clients?: number | null
          predicted_revenue?: number | null
          reference_month: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          model_inputs?: Json | null
          organization_id?: string
          predicted_churn?: number | null
          predicted_new_clients?: number | null
          predicted_revenue?: number | null
          reference_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_forecasts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_queue: {
        Row: {
          chat_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          organization_id: string
          scheduled_at: string
          started_at: string | null
          status: string | null
          step_number: number
          tracking_id: string
        }
        Insert: {
          chat_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id: string
          scheduled_at: string
          started_at?: string | null
          status?: string | null
          step_number: number
          tracking_id: string
        }
        Update: {
          chat_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          organization_id?: string
          scheduled_at?: string
          started_at?: string | null
          status?: string | null
          step_number?: number
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequence_triggers: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          sequence_id: string
          trigger_tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          sequence_id: string
          trigger_tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          sequence_id?: string
          trigger_tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequence_triggers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_sequence_triggers_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_sequence_triggers_trigger_tag_id_fkey"
            columns: ["trigger_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_step_messages: {
        Row: {
          content: string | null
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          message_order: number
          message_type: string
          organization_id: string
          step_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_order: number
          message_type?: string
          organization_id: string
          step_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_order?: number
          message_type?: string
          organization_id?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_step_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_step_messages_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "follow_up_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_steps: {
        Row: {
          created_at: string
          delay_hours: number
          id: string
          message: string | null
          organization_id: string
          sequence_id: string
          step_number: number
          tag_id: string
        }
        Insert: {
          created_at?: string
          delay_hours: number
          id?: string
          message?: string | null
          organization_id: string
          sequence_id: string
          step_number: number
          tag_id: string
        }
        Update: {
          created_at?: string
          delay_hours?: number
          id?: string
          message?: string | null
          organization_id?: string
          sequence_id?: string
          step_number?: number
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_steps_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_webhook_log: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          organization_id: string
          step_number: number
          success: boolean
          tracking_id: string
          webhook_payload: Json
          webhook_response: Json | null
          webhook_sent_at: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          step_number: number
          success?: boolean
          tracking_id: string
          webhook_payload: Json
          webhook_response?: Json | null
          webhook_sent_at?: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          step_number?: number
          success?: boolean
          tracking_id?: string
          webhook_payload?: Json
          webhook_response?: Json | null
          webhook_sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_webhook_log_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_webhook_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_webhook_log_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "lead_follow_up_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_members: {
        Row: {
          created_at: string
          funnel_id: string
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          funnel_id: string
          id?: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          funnel_id?: string
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_members_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string
          created_at: string
          funnel_id: string
          id: string
          name: string
          order_position: number
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          order_position?: number
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          order_position?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          config: Json | null
          created_at: string | null
          data_source: string
          id: string
          is_public: boolean
          name: string
          organization_id: string
          tag_order: string[] | null
          updated_at: string | null
          visualization_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          data_source?: string
          id?: string
          is_public?: boolean
          name: string
          organization_id: string
          tag_order?: string[] | null
          updated_at?: string | null
          visualization_type?: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          data_source?: string
          id?: string
          is_public?: boolean
          name?: string
          organization_id?: string
          tag_order?: string[] | null
          updated_at?: string | null
          visualization_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_connections: {
        Row: {
          access_token: string | null
          conversation_provider_id: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          location_id: string | null
          organization_id: string
          refresh_token: string | null
          scopes: string[] | null
          sync_calendars: boolean | null
          sync_contacts: boolean | null
          sync_messages: boolean | null
          sync_pipelines: boolean | null
          sync_tags: boolean | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          conversation_provider_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          location_id?: string | null
          organization_id: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_calendars?: boolean | null
          sync_contacts?: boolean | null
          sync_messages?: boolean | null
          sync_pipelines?: boolean | null
          sync_tags?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          conversation_provider_id?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          location_id?: string | null
          organization_id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          sync_calendars?: boolean | null
          sync_contacts?: boolean | null
          sync_messages?: boolean | null
          sync_pipelines?: boolean | null
          sync_tags?: boolean | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_global_config: {
        Row: {
          base_domain: string | null
          client_id: string
          client_secret: string
          created_at: string
          id: string
          redirect_uri: string
          sso_shared_secret: string | null
          updated_at: string
        }
        Insert: {
          base_domain?: string | null
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          redirect_uri?: string
          sso_shared_secret?: string | null
          updated_at?: string
        }
        Update: {
          base_domain?: string | null
          client_id?: string
          client_secret?: string
          created_at?: string
          id?: string
          redirect_uri?: string
          sso_shared_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ghl_sync_logs: {
        Row: {
          created_at: string
          direction: string
          id: string
          message: string | null
          organization_id: string
          resource_id: string | null
          resource_type: string
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          id?: string
          message?: string | null
          organization_id: string
          resource_id?: string | null
          resource_type: string
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          message?: string | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_sync_mappings: {
        Row: {
          created_at: string
          ghl_id: string
          id: string
          last_synced_at: string
          organization_id: string
          resource_type: string
          vitta_id: string
        }
        Insert: {
          created_at?: string
          ghl_id: string
          id?: string
          last_synced_at?: string
          organization_id: string
          resource_type: string
          vitta_id: string
        }
        Update: {
          created_at?: string
          ghl_id?: string
          id?: string
          last_synced_at?: string
          organization_id?: string
          resource_type?: string
          vitta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ghl_sync_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      global_ai_prompts: {
        Row: {
          category: string
          content: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          prompt_key: string
          system_message: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          prompt_key: string
          system_message?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          prompt_key?: string
          system_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      global_config: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      global_connection_prices: {
        Row: {
          base_price: number
          connection_key: string
          id: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          connection_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          connection_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_module_prices: {
        Row: {
          base_price: number
          id: string
          module_key: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          id?: string
          module_key: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          id?: string
          module_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_user_config: {
        Row: {
          default_max_users: number
          default_price_per_extra_user: number
          id: string
          updated_at: string
        }
        Insert: {
          default_max_users?: number
          default_price_per_extra_user?: number
          id?: string
          updated_at?: string
        }
        Update: {
          default_max_users?: number
          default_price_per_extra_user?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_calendar_config: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          organization_id: string
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          organization_id: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          organization_id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token: string | null
          connected_account_name: string | null
          connected_email: string | null
          created_at: string
          id: string
          is_connected: boolean
          metadata: Json | null
          organization_id: string
          refresh_token: string | null
          service_type: string
          token_expiry: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_token?: string | null
          connected_account_name?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          metadata?: Json | null
          organization_id: string
          refresh_token?: string | null
          service_type: string
          token_expiry?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_token?: string | null
          connected_account_name?: string | null
          connected_email?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          metadata?: Json | null
          organization_id?: string
          refresh_token?: string | null
          service_type?: string
          token_expiry?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_participants: {
        Row: {
          created_at: string
          display_name: string | null
          group_chat_id: string
          id: string
          is_admin: boolean
          organization_id: string
          participant_jid: string
          participant_phone: string
          profile_picture_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          group_chat_id: string
          id?: string
          is_admin?: boolean
          organization_id: string
          participant_jid: string
          participant_phone: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          group_chat_id?: string
          id?: string
          is_admin?: boolean
          organization_id?: string
          participant_jid?: string
          participant_phone?: string
          profile_picture_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_participants_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_participants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_diagnostic_goals: {
        Row: {
          created_at: string | null
          goal_name: string
          goal_value: number
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          goal_name: string
          goal_value?: number
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          goal_name?: string
          goal_value?: number
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_diagnostic_goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_diagnostics: {
        Row: {
          ad_spend: number | null
          cac_approximate: number | null
          cac_marketing: number | null
          campaign_clicks: number | null
          campaign_conversions: number | null
          campaign_cost_per_conversion: number | null
          campaign_cpc: number | null
          campaign_ctr: number | null
          campaign_impressions: number | null
          campaign_name: string | null
          campaign_notes: string | null
          campaign_platform: string | null
          closers_result: number | null
          commission_rate: number | null
          commission_total: number | null
          contracts_won: number | null
          conversion_rate: number | null
          cpl: number | null
          cprf: number | null
          created_at: string | null
          id: string
          ltv_total: number | null
          meeting_rate: number | null
          meetings_done: number | null
          meetings_scheduled: number | null
          mrr: number | null
          no_show: number | null
          organization_id: string
          reference_month: string
          roas: number | null
          ticket_medio: number | null
          total_leads: number | null
          updated_at: string | null
        }
        Insert: {
          ad_spend?: number | null
          cac_approximate?: number | null
          cac_marketing?: number | null
          campaign_clicks?: number | null
          campaign_conversions?: number | null
          campaign_cost_per_conversion?: number | null
          campaign_cpc?: number | null
          campaign_ctr?: number | null
          campaign_impressions?: number | null
          campaign_name?: string | null
          campaign_notes?: string | null
          campaign_platform?: string | null
          closers_result?: number | null
          commission_rate?: number | null
          commission_total?: number | null
          contracts_won?: number | null
          conversion_rate?: number | null
          cpl?: number | null
          cprf?: number | null
          created_at?: string | null
          id?: string
          ltv_total?: number | null
          meeting_rate?: number | null
          meetings_done?: number | null
          meetings_scheduled?: number | null
          mrr?: number | null
          no_show?: number | null
          organization_id: string
          reference_month: string
          roas?: number | null
          ticket_medio?: number | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_spend?: number | null
          cac_approximate?: number | null
          cac_marketing?: number | null
          campaign_clicks?: number | null
          campaign_conversions?: number | null
          campaign_cost_per_conversion?: number | null
          campaign_cpc?: number | null
          campaign_ctr?: number | null
          campaign_impressions?: number | null
          campaign_name?: string | null
          campaign_notes?: string | null
          campaign_platform?: string | null
          closers_result?: number | null
          commission_rate?: number | null
          commission_total?: number | null
          contracts_won?: number | null
          conversion_rate?: number | null
          cpl?: number | null
          cprf?: number | null
          created_at?: string | null
          id?: string
          ltv_total?: number | null
          meeting_rate?: number | null
          meetings_done?: number | null
          meetings_scheduled?: number | null
          mrr?: number | null
          no_show?: number | null
          organization_id?: string
          reference_month?: string
          roas?: number | null
          ticket_medio?: number | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_diagnostics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_files: {
        Row: {
          chat_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          organization_id: string
          source: string
          uploaded_by: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          organization_id: string
          source?: string
          uploaded_by?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          organization_id?: string
          source?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_files_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_financial_metrics: {
        Row: {
          avg_ticket: number | null
          chat_id: string
          churn_risk: number | null
          created_at: string | null
          first_purchase_at: string | null
          id: string
          last_purchase_at: string | null
          ltv_estimated: number | null
          organization_id: string
          purchase_count: number | null
          revenue_per_meeting: number | null
          total_meetings: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          avg_ticket?: number | null
          chat_id: string
          churn_risk?: number | null
          created_at?: string | null
          first_purchase_at?: string | null
          id?: string
          last_purchase_at?: string | null
          ltv_estimated?: number | null
          organization_id: string
          purchase_count?: number | null
          revenue_per_meeting?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_ticket?: number | null
          chat_id?: string
          churn_risk?: number | null
          created_at?: string | null
          first_purchase_at?: string | null
          id?: string
          last_purchase_at?: string | null
          ltv_estimated?: number | null
          organization_id?: string
          purchase_count?: number | null
          revenue_per_meeting?: number | null
          total_meetings?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_financial_metrics_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_financial_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_follow_up_tracking: {
        Row: {
          chat_id: string
          completed: boolean
          created_at: string
          current_step: number
          id: string
          last_message_at: string
          last_sent_at: string | null
          next_trigger_at: string
          organization_id: string
          responded: boolean
          responded_at_step: number | null
          sequence_id: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          last_message_at: string
          last_sent_at?: string | null
          next_trigger_at: string
          organization_id: string
          responded?: boolean
          responded_at_step?: number | null
          sequence_id: string
          updated_at?: string
        }
        Update: {
          chat_id?: string
          completed?: boolean
          created_at?: string
          current_step?: number
          id?: string
          last_message_at?: string
          last_sent_at?: string | null
          next_trigger_at?: string
          organization_id?: string
          responded?: boolean
          responded_at_step?: number | null
          sequence_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_follow_up_tracking_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_follow_up_tracking_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_quality_scores: {
        Row: {
          analyzed_at: string | null
          chat_id: string
          closing_probability: number | null
          created_at: string | null
          engagement_score: number | null
          ghost_risk: number | null
          id: string
          intent_score: number | null
          intent_signals: string[] | null
          objection_count: number | null
          objections: string[] | null
          organization_id: string
          overall_quality_score: number | null
          quality_tier: string | null
          recommended_next_action: string | null
          response_speed_score: number | null
          revenue_per_lead: number | null
          sla_compliance_score: number | null
          sla_first_contact_minutes: number | null
          sla_first_contact_ok: boolean | null
          sla_followup_gaps: Json | null
          sla_total_attempts: number | null
          sla_violations: Json | null
          updated_at: string | null
        }
        Insert: {
          analyzed_at?: string | null
          chat_id: string
          closing_probability?: number | null
          created_at?: string | null
          engagement_score?: number | null
          ghost_risk?: number | null
          id?: string
          intent_score?: number | null
          intent_signals?: string[] | null
          objection_count?: number | null
          objections?: string[] | null
          organization_id: string
          overall_quality_score?: number | null
          quality_tier?: string | null
          recommended_next_action?: string | null
          response_speed_score?: number | null
          revenue_per_lead?: number | null
          sla_compliance_score?: number | null
          sla_first_contact_minutes?: number | null
          sla_first_contact_ok?: boolean | null
          sla_followup_gaps?: Json | null
          sla_total_attempts?: number | null
          sla_violations?: Json | null
          updated_at?: string | null
        }
        Update: {
          analyzed_at?: string | null
          chat_id?: string
          closing_probability?: number | null
          created_at?: string | null
          engagement_score?: number | null
          ghost_risk?: number | null
          id?: string
          intent_score?: number | null
          intent_signals?: string[] | null
          objection_count?: number | null
          objections?: string[] | null
          organization_id?: string
          overall_quality_score?: number | null
          quality_tier?: string | null
          recommended_next_action?: string | null
          response_speed_score?: number | null
          revenue_per_lead?: number | null
          sla_compliance_score?: number | null
          sla_first_contact_minutes?: number | null
          sla_first_contact_ok?: boolean | null
          sla_followup_gaps?: Json | null
          sla_total_attempts?: number | null
          sla_violations?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_quality_scores_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: true
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_quality_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date_end: string | null
          date_start: string | null
          id: string
          impressions: number | null
          organization_id: string
          platform: string
          raw_data: Json | null
          roas: number | null
          spend: number | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number | null
          organization_id: string
          platform: string
          raw_data?: Json | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number | null
          organization_id?: string
          platform?: string
          raw_data?: Json | null
          roas?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_credentials: {
        Row: {
          connected_at: string | null
          created_at: string | null
          credentials: Json
          id: string
          organization_id: string
          platform: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          credentials?: Json
          id?: string
          organization_id: string
          platform: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          credentials?: Json
          id?: string
          organization_id?: string
          platform?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_social_profiles: {
        Row: {
          created_at: string | null
          engagement_rate: number | null
          followers_count: number | null
          follows_count: number | null
          id: string
          organization_id: string
          page_likes: number | null
          page_reach: number | null
          platform: string
          posts_count: number | null
          profile_id: string | null
          profile_name: string | null
          profile_picture_url: string | null
          raw_data: Json | null
          recent_posts: Json | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          engagement_rate?: number | null
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          organization_id: string
          page_likes?: number | null
          page_reach?: number | null
          platform: string
          posts_count?: number | null
          profile_id?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          raw_data?: Json | null
          recent_posts?: Json | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          engagement_rate?: number | null
          followers_count?: number | null
          follows_count?: number | null
          id?: string
          organization_id?: string
          page_likes?: number | null
          page_reach?: number | null
          platform?: string
          posts_count?: number | null
          profile_id?: string | null
          profile_name?: string | null
          profile_picture_url?: string | null
          raw_data?: Json | null
          recent_posts?: Json | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_social_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_config: {
        Row: {
          access_token_encrypted: string | null
          active: boolean
          id: string
          public_key: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          active?: boolean
          id?: string
          public_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          active?: boolean
          id?: string
          public_key?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      message_tag_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          match_text: string
          match_type: string
          organization_id: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          match_text: string
          match_type?: string
          organization_id: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          match_text?: string
          match_type?: string
          organization_id?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_tag_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_tag_rules_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          edited_at: string | null
          error_message: string | null
          external_message_id: string | null
          failed_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_follow_up: boolean | null
          is_hidden_from_agents: boolean | null
          is_from_user: boolean
          message_type: string
          meta_message_id: string | null
          organization_id: string
          platform_deleted_at: string | null
          private: boolean
          quoted_external_message_id: string | null
          quoted_message_id: string | null
          quoted_preview: Json | null
          reactions: Json | null
          read_at: string | null
          sender_jid: string | null
          sender_name: string | null
          sender_phone: string | null
          sent_by: string | null
          sent_from_platform: boolean | null
          sync_source: string | null
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          failed_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_follow_up?: boolean | null
          is_hidden_from_agents?: boolean | null
          is_from_user?: boolean
          message_type: string
          meta_message_id?: string | null
          organization_id: string
          platform_deleted_at?: string | null
          private?: boolean
          quoted_external_message_id?: string | null
          quoted_message_id?: string | null
          quoted_preview?: Json | null
          reactions?: Json | null
          read_at?: string | null
          sender_jid?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          sent_from_platform?: boolean | null
          sync_source?: string | null
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          edited_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          failed_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_follow_up?: boolean | null
          is_hidden_from_agents?: boolean | null
          is_from_user?: boolean
          message_type?: string
          meta_message_id?: string | null
          organization_id?: string
          platform_deleted_at?: string | null
          private?: boolean
          quoted_external_message_id?: string | null
          quoted_message_id?: string | null
          quoted_preview?: Json | null
          reactions?: Json | null
          read_at?: string | null
          sender_jid?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sent_by?: string | null
          sent_from_platform?: boolean | null
          sync_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quoted_message_id_fkey"
            columns: ["quoted_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          connected_at: string
          connected_by: string | null
          created_at: string
          id: string
          instagram_business_account_id: string | null
          instagram_username: string | null
          is_active: boolean
          organization_id: string
          page_access_token: string
          page_id: string
          page_name: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          id?: string
          instagram_business_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean
          organization_id: string
          page_access_token: string
          page_id: string
          page_name?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          id?: string
          instagram_business_account_id?: string | null
          instagram_username?: string | null
          is_active?: boolean
          organization_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_auto_messages: {
        Row: {
          away_enabled: boolean
          away_message: string | null
          business_hours: Json
          created_at: string
          id: string
          organization_id: string
          timezone: string
          updated_at: string
          welcome_enabled: boolean
          welcome_inactive_hours: number
          welcome_message: string | null
        }
        Insert: {
          away_enabled?: boolean
          away_message?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          organization_id: string
          timezone?: string
          updated_at?: string
          welcome_enabled?: boolean
          welcome_inactive_hours?: number
          welcome_message?: string | null
        }
        Update: {
          away_enabled?: boolean
          away_message?: string | null
          business_hours?: Json
          created_at?: string
          id?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
          welcome_enabled?: boolean
          welcome_inactive_hours?: number
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_auto_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_connections: {
        Row: {
          active: boolean
          connection_key: string
          created_at: string
          id: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          connection_key: string
          created_at?: string
          id?: string
          organization_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          connection_key?: string
          created_at?: string
          id?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          module_key: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          module_key: string
          organization_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          module_key?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_token_balances: {
        Row: {
          id: string
          organization_id: string
          provider: string
          total_tokens: number
          updated_at: string
          used_tokens: number
        }
        Insert: {
          id?: string
          organization_id: string
          provider: string
          total_tokens?: number
          updated_at?: string
          used_tokens?: number
        }
        Update: {
          id?: string
          organization_id?: string
          provider?: string
          total_tokens?: number
          updated_at?: string
          used_tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_token_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active: boolean
          billing_day: number | null
          created_at: string
          evolution_api_key: string | null
          evolution_api_url: string | null
          evolution_webhook_url: string | null
          extra_users_contracted_at: string | null
          id: string
          instance_name: string | null
          lifetime: boolean
          max_users: number
          name: string
          plan: string | null
          plan_expires_at: string | null
          price_per_extra_user: number
          settings: Json | null
          slug: string
          strict_agent_isolation: boolean | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_day?: number | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_webhook_url?: string | null
          extra_users_contracted_at?: string | null
          id?: string
          instance_name?: string | null
          lifetime?: boolean
          max_users?: number
          name: string
          plan?: string | null
          plan_expires_at?: string | null
          price_per_extra_user?: number
          settings?: Json | null
          slug: string
          strict_agent_isolation?: boolean | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_day?: number | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          evolution_webhook_url?: string | null
          extra_users_contracted_at?: string | null
          id?: string
          instance_name?: string | null
          lifetime?: boolean
          max_users?: number
          name?: string
          plan?: string | null
          plan_expires_at?: string | null
          price_per_extra_user?: number
          settings?: Json | null
          slug?: string
          strict_agent_isolation?: boolean | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          boleto_url: string | null
          created_at: string
          due_date: string | null
          id: string
          mercadopago_external_reference: string | null
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          metadata: Json | null
          notes: string | null
          organization_id: string
          payment_date: string | null
          payment_link: string | null
          payment_method: string | null
          payment_type: string
          pix_copy_paste: string | null
          pix_qr_code: string | null
          reference_month: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          boleto_url?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          mercadopago_external_reference?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id: string
          payment_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          payment_type?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          reference_month: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          boleto_url?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          mercadopago_external_reference?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          payment_date?: string | null
          payment_link?: string | null
          payment_method?: string | null
          payment_type?: string
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          reference_month?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_subscriptions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          extra_users: number
          full_name: string
          id: string
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          org_name: string
          org_slug: string
          password_hash: string
          plan: string
          selected_connections: string[]
          selected_modules: string[]
          status: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          extra_users?: number
          full_name: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          org_name: string
          org_slug: string
          password_hash: string
          plan?: string
          selected_connections?: string[]
          selected_modules?: string[]
          status?: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          extra_users?: number
          full_name?: string
          id?: string
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          org_name?: string
          org_slug?: string
          password_hash?: string
          plan?: string
          selected_connections?: string[]
          selected_modules?: string[]
          status?: string
          total_amount?: number
        }
        Relationships: []
      }
      pending_token_purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mercadopago_external_reference: string | null
          mercadopago_payment_id: string | null
          mercadopago_preference_id: string | null
          organization_id: string
          paid_at: string | null
          payment_link: string | null
          payment_method: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          price: number
          provider: string
          status: string
          token_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mercadopago_external_reference?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          organization_id: string
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          price: number
          provider: string
          status?: string
          token_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mercadopago_external_reference?: string | null
          mercadopago_payment_id?: string | null
          mercadopago_preference_id?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_link?: string | null
          payment_method?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          price?: number
          provider?: string
          status?: string
          token_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_token_purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_token_purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_chats: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          organization_id: string
          position: number
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          position?: number
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_chats_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_chats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_messages: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          message_id: string
          organization_id: string
          pinned_by: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          message_id: string
          organization_id: string
          pinned_by: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          organization_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean | null
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          ghl_location_id: string | null
          ghl_user_id: string | null
          id: string
          message_signature_enabled: boolean
          organization_id: string | null
          pending_approval: boolean | null
          preferred_language: string | null
          requested_org_slug: string | null
          show_resolved_assigned_chats: boolean | null
          show_team_assigned_chats: boolean
        }
        Insert: {
          approved?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          ghl_location_id?: string | null
          ghl_user_id?: string | null
          id: string
          message_signature_enabled?: boolean
          organization_id?: string | null
          pending_approval?: boolean | null
          preferred_language?: string | null
          requested_org_slug?: string | null
          show_resolved_assigned_chats?: boolean | null
          show_team_assigned_chats?: boolean
        }
        Update: {
          approved?: boolean | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          ghl_location_id?: string | null
          ghl_user_id?: string | null
          id?: string
          message_signature_enabled?: boolean
          organization_id?: string | null
          pending_approval?: boolean | null
          preferred_language?: string | null
          requested_org_slug?: string | null
          show_resolved_assigned_chats?: boolean | null
          show_team_assigned_chats?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          cancelled_at: string | null
          chat_id: string
          content: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string | null
          organization_id: string
          scheduled_for: string
          sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          chat_id: string
          content: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string | null
          organization_id: string
          scheduled_for: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          chat_id?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string | null
          organization_id?: string
          scheduled_for?: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_config: {
        Row: {
          activity_goals: Json | null
          created_at: string | null
          id: string
          max_first_contact_minutes: number | null
          max_followup_interval_hours: number | null
          min_contact_attempts: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          activity_goals?: Json | null
          created_at?: string | null
          id?: string
          max_first_contact_minutes?: number | null
          max_followup_interval_hours?: number | null
          min_contact_attempts?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          activity_goals?: Json | null
          created_at?: string | null
          id?: string
          max_first_contact_minutes?: number | null
          max_followup_interval_hours?: number | null
          min_contact_attempts?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slash_command_executions: {
        Row: {
          chat_id: string
          command_id: string
          completed_at: string | null
          current_step: number
          executed_by: string | null
          id: string
          organization_id: string
          started_at: string
          status: string
          total_steps: number
        }
        Insert: {
          chat_id: string
          command_id: string
          completed_at?: string | null
          current_step?: number
          executed_by?: string | null
          id?: string
          organization_id: string
          started_at?: string
          status?: string
          total_steps: number
        }
        Update: {
          chat_id?: string
          command_id?: string
          completed_at?: string | null
          current_step?: number
          executed_by?: string | null
          id?: string
          organization_id?: string
          started_at?: string
          status?: string
          total_steps?: number
        }
        Relationships: [
          {
            foreignKeyName: "slash_command_executions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_command_executions_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "slash_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_command_executions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_command_executions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slash_command_steps: {
        Row: {
          command_id: string
          content: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          organization_id: string
          step_order: number
        }
        Insert: {
          command_id: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type: string
          organization_id: string
          step_order: number
        }
        Update: {
          command_id?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          organization_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "slash_command_steps_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "slash_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_command_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      slash_commands: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          delay_seconds: number
          description: string | null
          id: string
          name: string
          organization_id: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          description?: string | null
          id?: string
          name: string
          organization_id: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          delay_seconds?: number
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slash_commands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slash_commands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          id: string
          logo_url: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          logo_url?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          logo_url?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tag_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_group_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_group_members_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          name: string
          order_position: number | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          order_position?: number | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          order_position?: number | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          chat_id: string | null
          completed: boolean | null
          created_at: string | null
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          organization_id: string
          priority: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          chat_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          organization_id: string
          priority?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          chat_id?: string | null
          completed?: boolean | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          organization_id?: string
          priority?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      token_packages: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          order_position: number
          price: number
          price_per_1k_tokens: number | null
          provider: string
          token_amount: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          order_position?: number
          price: number
          price_per_1k_tokens?: number | null
          provider: string
          token_amount: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          order_position?: number
          price?: number
          price_per_1k_tokens?: number | null
          provider?: string
          token_amount?: number
        }
        Relationships: []
      }
      token_transactions: {
        Row: {
          amount: number
          automation_execution_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          provider: string
          transaction_type: string
        }
        Insert: {
          amount: number
          automation_execution_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          provider: string
          transaction_type: string
        }
        Update: {
          amount?: number
          automation_execution_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          provider?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          chat_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration: string | null
          id: string
          organization_id: string
          product_name: string | null
          purchase_date: string | null
          transaction_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          chat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          organization_id: string
          product_name?: string | null
          purchase_date?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          chat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          organization_id?: string
          product_name?: string | null
          purchase_date?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_organizations: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_organizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_permissions: {
        Row: {
          created_at: string
          id: string
          page: Database["public"]["Enums"]["app_page"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page: Database["public"]["Enums"]["app_page"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page?: Database["public"]["Enums"]["app_page"]
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          id: string
          is_online: boolean
          last_seen_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_online?: boolean
          last_seen_at?: string
          organization_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_online?: boolean
          last_seen_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_official_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          delay_seconds: number | null
          failed_count: number | null
          id: string
          name: string
          organization_id: string
          scheduled_at: string | null
          sent_count: number | null
          started_at: string | null
          status: string | null
          target_funnel_id: string | null
          target_list_id: string | null
          target_phones: Json | null
          target_stage_id: string | null
          target_tag_ids: Json | null
          target_type: string
          template_id: string
          total_recipients: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          failed_count?: number | null
          id?: string
          name: string
          organization_id: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          target_funnel_id?: string | null
          target_list_id?: string | null
          target_phones?: Json | null
          target_stage_id?: string | null
          target_tag_ids?: Json | null
          target_type: string
          template_id: string
          total_recipients?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          failed_count?: number | null
          id?: string
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          sent_count?: number | null
          started_at?: string | null
          status?: string | null
          target_funnel_id?: string | null
          target_list_id?: string | null
          target_phones?: Json | null
          target_stage_id?: string | null
          target_tag_ids?: Json | null
          target_type?: string
          template_id?: string
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_official_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_official_campaigns_target_funnel_id_fkey"
            columns: ["target_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_official_campaigns_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "broadcast_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_official_campaigns_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_official_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "wa_official_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_official_templates: {
        Row: {
          category: string
          components: Json
          created_at: string | null
          id: string
          language: string
          meta_template_id: string | null
          name: string
          organization_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          components: Json
          created_at?: string | null
          id?: string
          language: string
          meta_template_id?: string | null
          name: string
          organization_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          components?: Json
          created_at?: string | null
          id?: string
          language?: string
          meta_template_id?: string | null
          name?: string
          organization_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_official_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event_type: string
          headers: Json | null
          id: string
          name: string
          organization_id: string
          updated_at: string
          url: string
          webhook_type: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
          url: string
          webhook_type?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
          url?: string
          webhook_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          assigned_user_id: string | null
          connected_at: string | null
          created_at: string
          display_name: string | null
          ghl_user_id: string | null
          id: string
          instance_name: string | null
          is_default: boolean | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          ghl_user_id?: string | null
          id?: string
          instance_name?: string | null
          is_default?: boolean | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          connected_at?: string | null
          created_at?: string
          display_name?: string | null
          ghl_user_id?: string | null
          id?: string
          instance_name?: string | null
          is_default?: boolean | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invite: {
        Args: { org_slug: string }
        Returns: boolean
      }
      check_overdue_payments: { Args: never; Returns: undefined }
      cleanup_old_automation_logs: { Args: never; Returns: undefined }
      ensure_system_custom_fields: {
        Args: { org_id: string }
        Returns: undefined
      }
      get_chat_ids_with_all_tags: {
        Args: { org_id: string; tag_ids: string[] }
        Returns: {
          chat_id: string
        }[]
      }
      get_chats_awaiting_response: {
        Args: { org_id: string }
        Returns: {
          chat_id: string
        }[]
      }
      get_org_user_count: { Args: { org_id: string }; Returns: number }
      get_organizations_stats_batch: {
        Args: never
        Returns: {
          organization_id: string
          total_leads: number
          total_messages: number
          total_revenue: number
          total_users: number
        }[]
      }
      get_unread_counts: {
        Args: { org_id: string }
        Returns: {
          chat_id: string
          unread_count: number
        }[]
      }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      get_user_organization_slug: {
        Args: { _user_id: string }
        Returns: string
      }
      has_page_permission: {
        Args: {
          _page: Database["public"]["Enums"]["app_page"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      increment_node_stat_reached:
        | {
            Args: {
              p_automation_id: string
              p_node_id: string
              p_organization_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_automation_id: string
              p_chat_id?: string
              p_node_id: string
              p_organization_id: string
            }
            Returns: undefined
          }
      increment_node_stat_responded: {
        Args: {
          p_automation_id: string
          p_chat_id?: string
          p_node_id: string
          p_organization_id: string
        }
        Returns: undefined
      }
      is_member_of_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_strictly_isolated: {
        Args: { check_user_id: string; org_id: string }
        Returns: boolean
      }
      is_sub_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      upsert_flow_edges: {
        Args: {
          p_automation_id: string
          p_edges: Json
          p_organization_id: string
        }
        Returns: undefined
      }
      validate_organization_slug: {
        Args: { slug_to_check: string }
        Returns: boolean
      }
    }
    Enums: {
      app_page:
        | "dashboard"
        | "leads"
        | "pipeline"
        | "users"
        | "developer"
        | "followup"
        | "promptia"
        | "chat"
        | "agenda"
        | "teams"
        | "financeiro"
        | "commands"
        | "automations"
        | "diagnostico"
      app_role: "admin" | "moderator" | "user" | "super_admin" | "sub_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_page: [
        "dashboard",
        "leads",
        "pipeline",
        "users",
        "developer",
        "followup",
        "promptia",
        "chat",
        "agenda",
        "teams",
        "financeiro",
        "commands",
        "automations",
        "diagnostico",
      ],
      app_role: ["admin", "moderator", "user", "super_admin", "sub_admin"],
    },
  },
} as const
