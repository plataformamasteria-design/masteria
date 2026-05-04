#!/bin/bash

# Auto-Fix Server Script - Resolve conflitos de porta automaticamente
# Este script é executado antes do servidor iniciar

PORT=${PORT:-5000}

echo "🔧 Auto-Fix Server - Iniciando verificações..."

# Função para encontrar processos na porta
find_processes_on_port() {
    local port=$1
    # Tenta diferentes métodos para encontrar processos
    
    # Método 1: netstat (se disponível)
    if command -v netstat &> /dev/null; then
        netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1
    fi
    
    # Método 2: ss (se disponível)
    if command -v ss &> /dev/null; then
        ss -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | grep -oP '\d+(?=/)'
    fi
    
    # Método 3: fuser (se disponível)
    if command -v fuser &> /dev/null; then
        fuser $port/tcp 2>/dev/null
    fi
}

# Função para matar processos na porta
kill_port_processes() {
    local port=$1
    echo "🔍 Verificando processos na porta $port..."
    
    # Mata processos Node.js e tsx que podem estar usando a porta
    pkill -9 -f "node.*server" 2>/dev/null && echo "✅ Processos node server finalizados"
    pkill -9 -f "tsx.*server" 2>/dev/null && echo "✅ Processos tsx server finalizados"
    pkill -9 -f "next.*dev" 2>/dev/null && echo "✅ Processos next dev finalizados"
    
    # Aguarda um momento para garantir que os processos foram finalizados
    sleep 1
    
    # Verifica se ainda há processos na porta
    local pids=$(find_processes_on_port $port)
    
    if [ -n "$pids" ]; then
        echo "⚠️ Ainda há processos na porta $port. Tentando finalizar: $pids"
        for pid in $pids; do
            if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                kill -9 $pid 2>/dev/null && echo "✅ Processo $pid finalizado"
            fi
        done
        sleep 1
    fi
    
    echo "✅ Porta $port liberada!"
}

# Limpar processos antigos
kill_port_processes $PORT

# Verificar se a porta está realmente livre
if command -v nc &> /dev/null; then
    if nc -z localhost $PORT 2>/dev/null; then
        echo "⚠️ Porta $PORT ainda ocupada. Tentando novamente..."
        kill_port_processes $PORT
        sleep 2
    fi
fi

# Limpar arquivos temporários que podem causar problemas
echo "🧹 Limpando arquivos temporários..."
rm -rf .next/cache 2>/dev/null || true

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "⚠️ node_modules não encontrado. Execute 'npm install' primeiro."
    exit 1
fi

echo "✅ Auto-Fix concluído! Servidor pronto para iniciar."
exit 0
