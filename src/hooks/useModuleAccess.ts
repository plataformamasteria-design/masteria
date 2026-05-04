"use client"

// Hook de compatibilidade legado para destravar módulos avançados no ReactFlow UI
export function useModuleAccess() {
    return {
        canUseAIAutomation: true,
    };
}
