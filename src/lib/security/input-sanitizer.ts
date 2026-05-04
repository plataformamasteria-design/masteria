// src/lib/security/input-sanitizer.ts
// Sistema de validação de entrada para detectar ameaças de segurança

export type ThreatType =
    | 'PROMPT_INJECTION'
    | 'JAILBREAK'
    | 'SQL_INJECTION'
    | 'SCRIPT_INJECTION'
    | 'DATA_EXTRACTION'
    | 'PHISHING'
    | 'SOCIAL_ENGINEERING'
    | 'SUSPICIOUS_PATTERN';

export type ThreatLevel = 'SAFE' | 'SUSPICIOUS' | 'BLOCKED';

export interface ThreatMatch {
    type: ThreatType;
    pattern: string;
    matched: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface SecurityCheckResult {
    isSafe: boolean;
    threatLevel: ThreatLevel;
    threats: ThreatMatch[];
    sanitizedContent: string;
    shouldBlock: boolean;
    shouldAlert: boolean;
}

// ============================================
// PADRÕES DE DETECÇÃO DE AMEAÇAS
// ============================================

const THREAT_PATTERNS: Array<{
    pattern: RegExp;
    type: ThreatType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
}> = [
        // === PROMPT INJECTION / JAILBREAK (CRÍTICO) ===
        {
            pattern: /ignore\s+(all\s+)?(your\s+)?(previous|prior|above|todas|as)\s+(instructions?|rules?|guidelines?|instruções?|regras?)/i,
            type: 'PROMPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Tentativa de ignorar instruções anteriores'
        },
        {
            pattern: /ignor(e|ar)\s+(todas?|all)\s+(as\s+)?instruções/i,
            type: 'PROMPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Tentativa de ignorar instruções (PT)'
        },
        {
            pattern: /you\s+are\s+now\s+(a|an|the)\s+/i,
            type: 'JAILBREAK',
            severity: 'CRITICAL',
            description: 'Tentativa de redefinir identidade do agente'
        },
        {
            pattern: /new\s+(system\s+)?instructions?:\s*/i,
            type: 'PROMPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Tentativa de injetar novas instruções'
        },
        {
            pattern: /\bDAN\s+mode\b/i,
            type: 'JAILBREAK',
            severity: 'CRITICAL',
            description: 'Tentativa de ativar modo DAN (Do Anything Now)'
        },
        {
            pattern: /bypass\s+(all\s+)?(your\s+)?(restrictions?|safety|filters?)/i,
            type: 'JAILBREAK',
            severity: 'CRITICAL',
            description: 'Tentativa de bypass de restrições'
        },
        {
            pattern: /pretend\s+(you\s+are|to\s+be|that\s+you)/i,
            type: 'JAILBREAK',
            severity: 'HIGH',
            description: 'Tentativa de roleplay malicioso'
        },
        {
            pattern: /act\s+as\s+if\s+(you\s+)?(were|are|have)/i,
            type: 'JAILBREAK',
            severity: 'HIGH',
            description: 'Tentativa de alteração de comportamento'
        },
        {
            pattern: /forget\s+(all\s+)?(your\s+)?(previous|prior|training)/i,
            type: 'PROMPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Tentativa de reset de memória'
        },
        {
            pattern: /\bsystem\s*prompt\b/i,
            type: 'PROMPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Referência ao system prompt'
        },
        {
            pattern: /\b(reveal|show|display)\s+(your\s+)?(instructions?|prompt|config)/i,
            type: 'PROMPT_INJECTION',
            severity: 'HIGH',
            description: 'Tentativa de revelar configuração'
        },
        {
            pattern: /\benglish\s+only\s+mode\b/i,
            type: 'JAILBREAK',
            severity: 'MEDIUM',
            description: 'Possível técnica de jailbreak'
        },
        {
            pattern: /\b(developer|admin|god)\s+mode\b/i,
            type: 'JAILBREAK',
            severity: 'CRITICAL',
            description: 'Tentativa de modo privilegiado'
        },

        // === SQL INJECTION (CRÍTICO) ===
        {
            pattern: /'\s*;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE)\s+/i,
            type: 'SQL_INJECTION',
            severity: 'CRITICAL',
            description: 'SQL Injection - comando destrutivo'
        },
        {
            pattern: /\bOR\s+['"]?1['"]?\s*=\s*['"]?1['"]?/i,
            type: 'SQL_INJECTION',
            severity: 'CRITICAL',
            description: 'SQL Injection - bypass de autenticação'
        },
        {
            pattern: /\bUNION\s+(ALL\s+)?SELECT\b/i,
            type: 'SQL_INJECTION',
            severity: 'CRITICAL',
            description: 'SQL Injection - UNION SELECT'
        },
        {
            pattern: /--\s*$/m,
            type: 'SQL_INJECTION',
            severity: 'MEDIUM',
            description: 'Possível comentário SQL'
        },
        {
            pattern: /;\s*SELECT\s+/i,
            type: 'SQL_INJECTION',
            severity: 'HIGH',
            description: 'SQL Injection - múltiplos comandos'
        },

        // === SCRIPT INJECTION (CRÍTICO) ===
        {
            pattern: /<script\b[^>]*>/i,
            type: 'SCRIPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Tag de script HTML'
        },
        {
            pattern: /javascript\s*:/i,
            type: 'SCRIPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Protocolo JavaScript'
        },
        {
            pattern: /\beval\s*\(/i,
            type: 'SCRIPT_INJECTION',
            severity: 'CRITICAL',
            description: 'Função eval()'
        },
        {
            pattern: /\bon\w+\s*=\s*["']/i,
            type: 'SCRIPT_INJECTION',
            severity: 'HIGH',
            description: 'Event handler HTML'
        },
        {
            pattern: /<iframe\b/i,
            type: 'SCRIPT_INJECTION',
            severity: 'HIGH',
            description: 'Tag iframe'
        },

        // === EXTRAÇÃO DE DADOS (ALTO) ===
        {
            pattern: /list(e|ar)?\s+(all|todos?|todas?)\s*(os\s+|as\s+)?(the\s+)?(clients?|clientes?|users?|usuários?|customers?)/i,
            type: 'DATA_EXTRACTION',
            severity: 'HIGH',
            description: 'Tentativa de listar clientes/usuários'
        },
        {
            pattern: /export(e|ar)?\s+(all\s+|todos?\s*)?((os\s+)?dados?|(the\s+)?data|database|banco)/i,
            type: 'DATA_EXTRACTION',
            severity: 'HIGH',
            description: 'Tentativa de exportar dados'
        },
        {
            pattern: /show\s+(me\s+)?(all|the)\s+(database|banco|records?|registros?)/i,
            type: 'DATA_EXTRACTION',
            severity: 'HIGH',
            description: 'Tentativa de visualizar banco de dados'
        },
        {
            pattern: /dump\s+(the\s+)?(database|db|data)/i,
            type: 'DATA_EXTRACTION',
            severity: 'CRITICAL',
            description: 'Tentativa de dump de banco'
        },
        {
            pattern: /\b(give|send|email)\s+(me\s+)?(all\s+)?(contacts?|emails?|phones?)/i,
            type: 'DATA_EXTRACTION',
            severity: 'HIGH',
            description: 'Tentativa de obter lista de contatos'
        },

        // === PHISHING / SOCIAL ENGINEERING (MÉDIO-ALTO) ===
        {
            pattern: /\b(qual|what('s)?|give\s+me)\s+(a\s+|sua\s+|your\s+)?(senha|password|pwd)\b/i,
            type: 'PHISHING',
            severity: 'HIGH',
            description: 'Solicitação de senha'
        },
        {
            pattern: /\b(número|number|dados?)\s+(do\s+|of\s+)?(cartão|card|crédito|credit)/i,
            type: 'PHISHING',
            severity: 'CRITICAL',
            description: 'Solicitação de dados de cartão'
        },
        {
            pattern: /\bCVV\b/i,
            type: 'PHISHING',
            severity: 'CRITICAL',
            description: 'Referência a código CVV'
        },
        {
            pattern: /chave\s+pix\s+(do\s+)?(dono|owner|admin|empresa)/i,
            type: 'PHISHING',
            severity: 'HIGH',
            description: 'Solicitação de chave PIX do proprietário'
        },
        {
            pattern: /transfer(ir|ência)?\s+pix\s+(para|to)\s+(minha?|my)/i,
            type: 'SOCIAL_ENGINEERING',
            severity: 'HIGH',
            description: 'Tentativa de engenharia social para PIX'
        },
        {
            pattern: /\b(token|api\s*key|secret)\s+(de\s+|do\s+)?(acesso|access)/i,
            type: 'DATA_EXTRACTION',
            severity: 'CRITICAL',
            description: 'Solicitação de token/API key'
        },
        {
            pattern: /\b(cpf|cnpj)\s+(do\s+)?(dono|owner|admin|responsável)/i,
            type: 'DATA_EXTRACTION',
            severity: 'MEDIUM',
            description: 'Solicitação de CPF/CNPJ do proprietário'
        },

        // === PADRÕES SUSPEITOS (BAIXO-MÉDIO) ===
        {
            pattern: /\b(hack|hackear|invadir|exploit)\b/i,
            type: 'SUSPICIOUS_PATTERN',
            severity: 'MEDIUM',
            description: 'Menção a hacking'
        },
        {
            pattern: /\b(vulnerabilidade|vulnerability|exploit)\b/i,
            type: 'SUSPICIOUS_PATTERN',
            severity: 'LOW',
            description: 'Discussão de vulnerabilidades'
        },
    ];

// ============================================
// FUNÇÃO PRINCIPAL DE VERIFICAÇÃO
// ============================================

export function checkInputSecurity(content: string): SecurityCheckResult {
    const threats: ThreatMatch[] = [];

    // Verificar cada padrão
    for (const { pattern, type, severity, description } of THREAT_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
            threats.push({
                type,
                pattern: description,
                matched: match[0],
                severity,
            });
        }
    }

    // Determinar nível de ameaça
    const hasCritical = threats.some(t => t.severity === 'CRITICAL');
    const hasHigh = threats.some(t => t.severity === 'HIGH');
    const hasMedium = threats.some(t => t.severity === 'MEDIUM');

    let threatLevel: ThreatLevel = 'SAFE';
    let shouldBlock = false;
    let shouldAlert = false;

    if (hasCritical) {
        threatLevel = 'BLOCKED';
        shouldBlock = true;
        shouldAlert = true;
    } else if (hasHigh) {
        threatLevel = 'BLOCKED';
        shouldBlock = true;
        shouldAlert = true;
    } else if (hasMedium) {
        threatLevel = 'SUSPICIOUS';
        shouldAlert = true;
    } else if (threats.length > 0) {
        threatLevel = 'SUSPICIOUS';
    }

    // Sanitizar conteúdo (remover partes perigosas)
    let sanitizedContent = content;
    for (const { pattern } of THREAT_PATTERNS.filter(p => p.severity === 'CRITICAL')) {
        sanitizedContent = sanitizedContent.replace(pattern, '[REMOVED]');
    }

    return {
        isSafe: threats.length === 0,
        threatLevel,
        threats,
        sanitizedContent,
        shouldBlock,
        shouldAlert,
    };
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

export function getThreatSummary(result: SecurityCheckResult): string {
    if (result.isSafe) return 'Nenhuma ameaça detectada';

    const threatTypes = [...new Set(result.threats.map(t => t.type))];
    return `${result.threats.length} ameaça(s): ${threatTypes.join(', ')}`;
}

export function shouldBlockMessage(result: SecurityCheckResult): boolean {
    return result.shouldBlock;
}

export function getBlockedResponse(): string {
    return 'Desculpe, não posso processar esse tipo de solicitação. Posso ajudar com outra coisa?';
}
