#!/bin/bash

# 🚨 SECURITY ROTATION SCRIPT
# Execute após rotacionar todas as credenciais nos serviços

echo "🔐 ROTACIONANDO CREDENCIAIS LOCAIS..."

# Backup do .env atual
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Prompt para novas credenciais
echo "📝 Insira as novas credenciais:"

# Database
read -p "Nova DATABASE_URL: " NEW_DATABASE_URL
read -p "Nova VECTOR_DB_URL: " NEW_VECTOR_DB_URL

# Firebase
read -p "Nova FIREBASE_API_KEY: " NEW_FIREBASE_API_KEY

# Google AI
read -p "Nova GEMINI_API_KEY: " NEW_GEMINI_API_KEY

# AWS
read -p "Nova AWS_ACCESS_KEY_ID: " NEW_AWS_ACCESS_KEY_ID
read -s -p "Nova AWS_SECRET_ACCESS_KEY: " NEW_AWS_SECRET_ACCESS_KEY
echo

# JWT (gerar automaticamente)
NEW_JWT_SECRET=$(openssl rand -base64 192)
NEW_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Redis
read -p "Nova REDIS_URL: " NEW_REDIS_URL

# Criar novo .env
cat > .env << EOF
# =============================================================================
# 🗄️ DATABASE CONFIGURATION
# =============================================================================
DATABASE_URL=$NEW_DATABASE_URL
VECTOR_DB_URL=$NEW_VECTOR_DB_URL

# =============================================================================
# 🔥 FIREBASE CONFIGURATION
# =============================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=$NEW_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zap-master-mvp.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=zap-master-mvp
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zap-master-mvp.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1017516291210
NEXT_PUBLIC_FIREBASE_APP_ID=1:1017516291210:web:50b87a9acac0bb6293a973
NEXT_PUBLIC_MEASUREMENT_ID=G-JYNXTXE57S

# =============================================================================
# 🤖 AI & LLM CONFIGURATION
# =============================================================================
GEMINI_API_KEY=$NEW_GEMINI_API_KEY
GOOGLE_GENAI_API_KEY=$NEW_GEMINI_API_KEY

# =============================================================================
# 🔧 MCP SERVER CONFIGURATION
# =============================================================================
MCP_HTTP_SERVER_URL=http://localhost:3001

# =============================================================================
# 🌐 APPLICATION CONFIGURATION
# =============================================================================
NEXT_PUBLIC_BASE_URL=https://master.sendzap-ia.com
NEXT_PUBLIC_COMMIT_SHA=""

# =============================================================================
# 🔐 SECURITY & ENCRYPTION
# =============================================================================
JWT_SECRET_KEY=$NEW_JWT_SECRET
ENCRYPTION_KEY=$NEW_ENCRYPTION_KEY

# =============================================================================
# 📧 EMAIL CONFIGURATION
# =============================================================================
EMAIL_FROM_ADDRESS=contato@multidesk.io

# =============================================================================
# 📱 META/FACEBOOK INTEGRATION
# =============================================================================
META_VERIFY_TOKEN=123456789
FACEBOOK_API_VERSION=v20.0

# =============================================================================
# ☁️ AWS S3 CONFIGURATION
# =============================================================================
AWS_S3_BUCKET_NAME=${AWS_S3_BUCKET_NAME:-zapzapmaster}
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=$NEW_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$NEW_AWS_SECRET_ACCESS_KEY

# =============================================================================
# 🔄 CACHE & STORAGE
# =============================================================================
REDIS_URL=$NEW_REDIS_URL

# =============================================================================
# 🐛 DEBUG & LOGGING
# =============================================================================
LOG_WEBHOOKS=true
EOF

echo "✅ Credenciais rotacionadas com sucesso!"
echo "🔒 Backup salvo em: .env.backup.$(date +%Y%m%d_%H%M%S)"
echo "⚠️  Agora teste a aplicação para confirmar funcionamento!"
