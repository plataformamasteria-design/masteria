-- =============================================
-- SQL para executar no Supabase SQL Editor
-- Acesse: https://supabase.com > seu projeto > SQL Editor
-- =============================================

-- 1. Criar tabela da biblioteca de mídia dos agentes
CREATE TABLE IF NOT EXISTS agent_media_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    rule_id TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'document', 'audio', 'video')),
    file_size INTEGER,
    description TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índice para busca eficiente por organização + nó
CREATE INDEX IF NOT EXISTS agent_media_library_org_node_idx 
    ON agent_media_library (organization_id, node_id);

-- 3. RLS - habilitar Row Level Security (opcional, baseado no orgId da query)
-- ALTER TABLE agent_media_library ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Bucket do Supabase Storage: agent-library
-- Crie manualmente em: Storage > New Bucket
-- Nome: agent-library
-- Public: SIM (para URLs públicas)
-- File size limit: 50MB
-- Allowed MIME types: image/*, application/pdf, audio/*, video/*
-- =============================================

SELECT 'Tabela agent_media_library criada com sucesso!' as status;
