#!/bin/bash

# Safe Server Starter - Garante que o servidor sempre inicia corretamente
# com auto-fix automático de problemas

set -e  # Exit on error

PORT=${PORT:-8080}
MAX_RETRIES=3
RETRY_COUNT=0

echo "🚀 Safe Server Starter - Iniciando..."

# Função para iniciar o servidor
start_server() {
    echo "📦 Executando auto-fix..."
    bash scripts/auto-fix-server.sh || {
        echo "⚠️ Auto-fix falhou, tentando correção manual..."
        pkill -9 -f "node" 2>/dev/null || true
        pkill -9 -f "tsx" 2>/dev/null || true
        sleep 2
    }
    
    echo "🔄 Iniciando servidor na porta $PORT..."
    npm run dev:server
}

# Loop de retry com auto-fix
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if start_server; then
        echo "✅ Servidor iniciado com sucesso!"
        exit 0
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo "❌ Falha ao iniciar servidor (tentativa $RETRY_COUNT/$MAX_RETRIES)"
        
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "🔧 Executando correção automática..."
            pkill -9 -f "node" 2>/dev/null || true
            pkill -9 -f "tsx" 2>/dev/null || true
            sleep 3
        fi
    fi
done

echo "❌ Erro: Servidor falhou após $MAX_RETRIES tentativas"
echo "💡 Executando limpeza final..."
pkill -9 -f "node" 2>/dev/null || true
pkill -9 -f "tsx" 2>/dev/null || true
exit 1
