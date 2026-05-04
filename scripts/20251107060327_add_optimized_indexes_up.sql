-- =========================================
-- CORREÇÃO 8: ÍNDICES OTIMIZADOS
-- Migration: 20251107060327_add_optimized_indexes_up.sql
-- Objetivo: Criar índices compostos para otimizar queries lentas
-- =========================================

-- Índice 1: kanban_leads (board_id, stage_id, created_at)
-- Otimiza queries de busca de leads por board, stage e ordenação temporal
-- NOTA: kanban_leads NÃO tem company_id, tem board_id e stage_id
CREATE INDEX IF NOT EXISTS idx_kanban_leads_board_stage_created 
ON kanban_leads (board_id, stage_id, created_at DESC);

-- Índice 2: automation_logs (company_id, created_at)
-- Otimiza queries de logs de automação por empresa e ordenação temporal
CREATE INDEX IF NOT EXISTS idx_automation_logs_company_created_composite 
ON automation_logs (company_id, created_at DESC);

-- Índice 3: contacts_to_tags (contact_id, tag_id)
-- Otimiza JOINs de contatos com tags (usado na CORREÇÃO 7)
CREATE INDEX IF NOT EXISTS idx_contacts_to_tags_contact_tag 
ON contacts_to_tags (contact_id, tag_id);

-- Índice 4: contacts_to_contact_lists (contact_id, list_id)
-- Otimiza JOINs de contatos com listas (usado na CORREÇÃO 7)
CREATE INDEX IF NOT EXISTS idx_contacts_to_contact_lists_contact_list 
ON contacts_to_contact_lists (contact_id, list_id);

-- =========================================
-- VALIDAÇÃO DOS ÍNDICES CRIADOS
-- Execute após a migration:
-- SELECT indexname, tablename FROM pg_indexes 
-- WHERE tablename IN ('kanban_leads', 'automation_logs', 'contacts_to_tags', 'contacts_to_contact_lists')
--   AND indexname IN (
--     'idx_kanban_leads_board_stage_created',
--     'idx_automation_logs_company_created_composite',
--     'idx_contacts_to_tags_contact_tag',
--     'idx_contacts_to_contact_lists_contact_list'
--   )
-- ORDER BY tablename, indexname;
-- =========================================
