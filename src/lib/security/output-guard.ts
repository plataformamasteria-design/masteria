// src/lib/security/output-guard.ts
// Sistema de proteção de saída - previne vazamento de dados sensíveis

export interface SanitizedOutput {
    content: string;
    leaksDetected: string[];
    wasSanitized: boolean;
}

// ============================================
// PADRÕES DE DADOS SENSÍVEIS
// ============================================

const SENSITIVE_PATTERNS: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
}> = [
        // API Keys / Tokens (32+ caracteres alfanuméricos)
        {
            pattern: /\b(sk[-_]|pk[-_]|api[-_]?key[-_]?)?[A-Za-z0-9_-]{32,}\b/g,
            replacement: '[API_KEY_REDACTED]',
            description: 'API Key ou Token'
        },
        // Bearer Tokens
        {
            pattern: /Bearer\s+[A-Za-z0-9._-]+/gi,
            replacement: 'Bearer [TOKEN_REDACTED]',
            description: 'Bearer Token'
        },
        // CPF (com ou sem formatação)
        {
            pattern: /\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g,
            replacement: '***.***.***-**',
            description: 'CPF'
        },
        // CNPJ (com ou sem formatação)
        {
            pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}\b/g,
            replacement: '**.***.***/*****-**',
            description: 'CNPJ'
        },
        // Cartão de crédito (16 dígitos)
        {
            pattern: /\b\d{4}[\s.-]?\d{4}[\s.-]?\d{4}[\s.-]?\d{4}\b/g,
            replacement: '**** **** **** ****',
            description: 'Número de Cartão'
        },
        // CVV
        {
            pattern: /\bCVV\s*:?\s*\d{3,4}\b/gi,
            replacement: 'CVV: ***',
            description: 'Código CVV'
        },
        // Senhas em contexto
        {
            pattern: /(senha|password|pwd)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi,
            replacement: '$1: [REDACTED]',
            description: 'Senha'
        },
        // Email em massa (mais de 3 emails)
        {
            pattern: /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\s*[,;\n]\s*){3,}/gi,
            replacement: '[MULTIPLE_EMAILS_REDACTED]',
            description: 'Lista de Emails'
        },
        // Números de telefone em massa (mais de 3)
        {
            pattern: /(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}(\s*[,;\n]\s*(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}[-.\s]?\d{4}){2,}/g,
            replacement: '[MULTIPLE_PHONES_REDACTED]',
            description: 'Lista de Telefones'
        },
        // System Prompt vazado
        {
            pattern: /system\s*prompt\s*[:=]?\s*[`"']?[\s\S]{50,}?[`"']?/gi,
            replacement: '[SYSTEM_CONTENT_REDACTED]',
            description: 'System Prompt Vazado'
        },
        // Instruções internas
        {
            pattern: /(minhas?\s+)?instruções?\s+(são|internas?|de\s+sistema)\s*[:=]?[\s\S]{30,}/gi,
            replacement: '[INSTRUCTIONS_REDACTED]',
            description: 'Instruções Internas'
        },
        // Connection strings
        {
            pattern: /(postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
            replacement: '[DATABASE_URL_REDACTED]',
            description: 'Connection String'
        },
        // Chave PIX (formato UUID)
        {
            pattern: /chave\s+pix\s*[:=]?\s*[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi,
            replacement: 'chave pix: [PIX_KEY_REDACTED]',
            description: 'Chave PIX UUID'
        },
    ];

// ============================================
// FUNÇÃO PRINCIPAL DE SANITIZAÇÃO
// ============================================

export function sanitizeOutput(response: string): SanitizedOutput {
    let content = response;
    const leaksDetected: string[] = [];

    for (const { pattern, replacement, description } of SENSITIVE_PATTERNS) {
        // Verificar se o padrão existe
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
            leaksDetected.push(description);
            // Substituir pelo texto mascarado
            content = content.replace(pattern, replacement);
        }
    }

    return {
        content,
        leaksDetected,
        wasSanitized: leaksDetected.length > 0,
    };
}

// ============================================
// VALIDAÇÃO DE RESPOSTA DO AGENTE
// ============================================

export function validateAgentResponse(response: string): {
    isValid: boolean;
    issues: string[];
    sanitizedResponse: string;
} {
    const issues: string[] = [];

    // 1. Sanitizar dados sensíveis
    const sanitized = sanitizeOutput(response);
    if (sanitized.wasSanitized) {
        issues.push(`Dados sensíveis detectados e removidos: ${sanitized.leaksDetected.join(', ')}`);
    }

    // 2. Verificar se a resposta parece ter vazado instruções
    const instructionLeakPatterns = [
        /você\s+é\s+um\s+assistente\s+que/i,
        /suas?\s+instruções?\s+são/i,
        /meu\s+prompt\s+diz/i,
        /fui\s+configurado\s+para/i,
    ];

    for (const pattern of instructionLeakPatterns) {
        if (pattern.test(sanitized.content)) {
            issues.push('Possível vazamento de instruções internas');
        }
    }

    // 3. Verificar tamanho excessivo (possível dump)
    if (sanitized.content.length > 10000) {
        issues.push('Resposta excessivamente longa (possível data dump)');
    }

    return {
        isValid: issues.length === 0,
        issues,
        sanitizedResponse: sanitized.content,
    };
}
