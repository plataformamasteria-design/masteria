#!/bin/bash
# Script para limpar sessões no servidor de produção
# Uso: Execute no servidor de produção via Replit ou SSH

echo "=== 🧹 LIMPEZA DE SESSÕES NO SERVIDOR DE PRODUÇÃO ==="
echo ""

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script no diretório raiz do projeto"
    exit 1
fi

# Sincronizar com GitHub
echo "1️⃣ Sincronizando com GitHub..."
git pull origin main
echo ""

# Instalar dependências (se necessário)
echo "2️⃣ Verificando dependências..."
if [ ! -d "node_modules" ]; then
    echo "   Instalando dependências..."
    npm install
fi
echo ""

# Executar investigação
echo "3️⃣ Investigando sessões existentes..."
npx tsx scripts/investigate-all-sessions-deep.ts
echo ""

# Perguntar confirmação
read -p "4️⃣ Deseja limpar sessões órfãs? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "   Executando limpeza de sessões órfãs..."
    npx tsx scripts/cleanup-orphan-session-filesystem.ts
    echo ""
    
    read -p "5️⃣ Deseja limpar TODAS as sessões? (s/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "   ⚠️  ATENÇÃO: Isso deletará TODAS as sessões!"
        read -p "   Confirma? (s/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            npx tsx scripts/cleanup-all-baileys-sessions.ts
        fi
    fi
else
    echo "   Limpeza cancelada."
fi

echo ""
echo "=== ✅ LIMPEZA CONCLUÍDA ==="
echo ""
echo "📱 Próximos passos:"
echo "   1. Aguarde 5-10 minutos"
echo "   2. Verifique no WhatsApp: Configurações → Aparelhos conectados"
echo "   3. Os dispositivos devem desaparecer automaticamente"
echo ""
