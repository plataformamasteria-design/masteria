#!/bin/bash

# Health Check & Auto-Recovery System
# Monitora o servidor e corrige problemas automaticamente

PORT=${PORT:-8080}
CHECK_INTERVAL=30  # Verificar a cada 30 segundos

echo "🏥 Health Check System - Iniciado"
echo "📊 Monitorando servidor na porta $PORT"
echo "⏱️  Intervalo de verificação: ${CHECK_INTERVAL}s"

# Função para verificar se o servidor está respondendo
check_server_health() {
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ > /dev/null 2>&1; then
            return 0  # Servidor OK
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    return 1  # Servidor não está respondendo
}

# Função de auto-recovery
auto_recover() {
    echo "🚨 ALERTA: Servidor não está respondendo!"
    echo "🔧 Iniciando auto-recovery..."
    
    # 1. Executar auto-fix
    bash scripts/auto-fix-server.sh
    
    # 2. Aguardar um momento
    sleep 3
    
    # 3. Verificar se o problema foi resolvido
    if check_server_health; then
        echo "✅ Auto-recovery bem-sucedido! Servidor recuperado."
        return 0
    else
        echo "⚠️ Auto-recovery parcial. Pode ser necessário reiniciar o workflow."
        return 1
    fi
}

# Loop de monitoramento
while true; do
    sleep $CHECK_INTERVAL
    
    if ! check_server_health; then
        auto_recover
    fi
done
