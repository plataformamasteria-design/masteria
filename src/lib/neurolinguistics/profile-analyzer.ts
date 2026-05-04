
// src/lib/neurolinguistics/profile-analyzer.ts

/**
 * MOTOR DE INTELIGÊNCIA NEUROLINGUÍSTICA (VAK + CHASE HUGHES)
 * 
 * Este módulo analisa o texto do usuário para identificar:
 * 1. Perfil Representacional (Visual, Auditivo, Cinestésico)
 * 2. Necessidade Social Dominante (Chase Hughes)
 * 3. Ritmo de Comunicação (Pace)
 */

type VakProfile = 'VISUAL' | 'AUDITORY' | 'KINESTHETIC' | 'MIXED' | 'UNKNOWN';
type SocialNeed = 'SIGNIFICANCE' | 'ACCEPTANCE' | 'APPROVAL' | 'INTELLIGENCE' | 'PITY' | 'POWER' | 'UNKNOWN';
type CommunicationPace = 'FAST' | 'MODERATE' | 'SLOW';

interface PsychographicProfile {
    vakProfile: VakProfile;
    socialNeed: SocialNeed;
    communicationPace: CommunicationPace;
    confidence: number; // 0-100
}

// === DICIONÁRIOS DE PALAVRAS-CHAVE ===

const VAK_KEYWORDS = {
    VISUAL: [
        'ver', 'vejo', 'vê', 'olhar', 'olho', 'olha', 'mostrar', 'mostra', 'claro', 'brilhante', 'focar', 'imaginar', 'perspectiva',
        'imagem', 'foto', 'video', 'vídeo', 'cor', 'esclarecer', 'nítido', 'visível',
        'enxergar', 'enxergo', 'aparencia', 'aparência', 'bonito', 'feio', 'luz', 'sombra', 'vista',
        'horizonte', 'observar', 'brilho', 'ilustrar', 'desenhar', 'pintar', 'refletir'
    ],
    AUDITORY: [
        'ouvir', 'ouço', 'ouve', 'escutar', 'escuto', 'escuta', 'falar', 'falo', 'fala', 'dizer', 'digo', 'diz',
        'som', 'barulho', 'silencio', 'silêncio',
        'alto', 'baixo', 'tom', 'ritmo', 'conversa', 'dialogo', 'diálogo', 'discutir',
        'perguntar', 'responder', 'soar', 'ressonar', 'harmonia', 'sintonizar', 'anunciar',
        'mencionar', 'expressar', 'voz', 'ruído', 'clique', 'ecoar', 'estalo'
    ],
    KINESTHETIC: [
        'sentir', 'sinto', 'sente', 'pegar', 'pego', 'pega', 'tocar', 'toco', 'toca', 'segurar', 'frio', 'quente', 'morno', 'pesado', 'leve',
        'confortável', 'confortavel', 'pressão', 'firme', 'suave', 'áspero', 'duro', 'mole',
        'movimento', 'correr', 'andar', 'impacto', 'tensão', 'relaxar', 'estresse', 'cansado',
        'energia', 'força', 'conexão', 'experiência', 'prática', 'ação', 'fazer'
    ]
};

const SOCIAL_NEED_INDICATORS = {
    SIGNIFICANCE: {
        pronouns: ['eu', 'meu', 'minha', 'mim', 'comigo'], // Foco no Eu
        keywords: ['conquista', 'sucesso', 'cargo', 'chefe', 'lider', 'líder', 'importante', 'legado', 'único', 'diferença', 'impacto']
    },
    ACCEPTANCE: {
        pronouns: ['nós', 'nosso', 'nossa', 'gente', 'equipe', 'grupo', 'time'], // Foco no Nós
        keywords: ['juntos', 'uniao', 'união', 'família', 'amigos', 'participar', 'pertencer', 'ajudar', 'colaborar']
    },
    APPROVAL: {
        keywords: ['desculpa', 'perdão', 'errado', 'ruim', 'fraco', 'tentei', 'espero', 'será que', 'acha que', 'opinião']
    },
    INTELLIGENCE: {
        keywords: ['lógica', 'logica', 'racional', 'pensar', 'analisar', 'estudo', 'pesquisa', 'fato', 'dados', 'teoria', 'livro', 'curso', 'diploma', 'mestrado', 'doutorado', 'inteligente', 'burro', 'idiota', 'sabio', 'sábio']
    },
    PITY: {
        keywords: ['difícil', 'dificil', 'sofrimento', 'dor', 'triste', 'azar', 'problema', 'ninguém', 'ajuda', 'socorro', 'vítima', 'vitima', 'injusto']
    },
    POWER: {
        keywords: ['controle', 'mandar', 'ordem', 'poder', 'força', 'exigir', 'agora', 'já', 'rápido', 'decidir', 'vencer', 'ganhar']
    }
};

/**
 * Analisa o texto e retorna o perfil neurolinguístico
 */
export function analyzeProfile(text: string): PsychographicProfile {
    const cleanText = text.toLowerCase();

    // 1. ANÁLISE VAK
    let visualCount = 0;
    let auditoryCount = 0;
    let kinestheticCount = 0;

    VAK_KEYWORDS.VISUAL.forEach(word => { if (cleanText.includes(word)) visualCount++; });
    VAK_KEYWORDS.AUDITORY.forEach(word => { if (cleanText.includes(word)) auditoryCount++; });
    VAK_KEYWORDS.KINESTHETIC.forEach(word => { if (cleanText.includes(word)) kinestheticCount++; });

    let vakProfile: VakProfile = 'MIXED';
    const maxVak = Math.max(visualCount, auditoryCount, kinestheticCount);

    if (maxVak > 0) {
        if (visualCount === maxVak && visualCount > auditoryCount && visualCount > kinestheticCount) vakProfile = 'VISUAL';
        else if (auditoryCount === maxVak && auditoryCount > visualCount && auditoryCount > kinestheticCount) vakProfile = 'AUDITORY';
        else if (kinestheticCount === maxVak && kinestheticCount > visualCount && kinestheticCount > auditoryCount) vakProfile = 'KINESTHETIC';
    } else {
        vakProfile = 'UNKNOWN';
    }

    // 2. ANÁLISE DE NECESSIDADE SOCIAL (CHASE HUGHES)
    const socialScores: Record<SocialNeed, number> = {
        'SIGNIFICANCE': 0, 'ACCEPTANCE': 0, 'APPROVAL': 0,
        'INTELLIGENCE': 0, 'PITY': 0, 'POWER': 0, 'UNKNOWN': 0
    };

    // Pronome Check (Muito forte para Significance vs Acceptance)
    const words = cleanText.split(/\s+/);
    words.forEach(w => {
        if (SOCIAL_NEED_INDICATORS.SIGNIFICANCE.pronouns.includes(w)) socialScores.SIGNIFICANCE += 2;
        if (SOCIAL_NEED_INDICATORS.ACCEPTANCE.pronouns.includes(w)) socialScores.ACCEPTANCE += 2;
    });

    // Keyword Check
    SOCIAL_NEED_INDICATORS.SIGNIFICANCE.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.SIGNIFICANCE += 3; });
    SOCIAL_NEED_INDICATORS.ACCEPTANCE.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.ACCEPTANCE += 3; });
    SOCIAL_NEED_INDICATORS.APPROVAL.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.APPROVAL += 3; });
    SOCIAL_NEED_INDICATORS.INTELLIGENCE.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.INTELLIGENCE += 3; });
    SOCIAL_NEED_INDICATORS.PITY.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.PITY += 3; });
    SOCIAL_NEED_INDICATORS.POWER.keywords.forEach(w => { if (cleanText.includes(w)) socialScores.POWER += 3; });

    let dominantNeed: SocialNeed = 'UNKNOWN';
    let maxScore = 0;

    Object.entries(socialScores).forEach(([need, score]) => {
        if (score > maxScore) {
            maxScore = score;
            dominantNeed = need as SocialNeed;
        }
    });

    // Se o score for muito baixo, manter UNKNOWN
    if (maxScore < 3) dominantNeed = 'UNKNOWN';

    // 3. RITMO DE COMUNICAÇÃO (PACE)
    // Baseado no perfil VAK (Visual = Rápido, Cinestésico = Lento) e tamanho da mensagem
    let pace: CommunicationPace = 'MODERATE';

    if (vakProfile === 'VISUAL') pace = 'FAST';
    else if (vakProfile === 'KINESTHETIC') pace = 'SLOW';

    // Ajuste por tamanho: mensagens muito longas tendem a ser mais reflexivas (SLOW)
    if (cleanText.length > 200) pace = 'SLOW';
    // Mensagens muito curtas e diretas (FAST)
    if (cleanText.length < 30) pace = 'FAST';

    return {
        vakProfile,
        socialNeed: dominantNeed,
        communicationPace: pace,
        confidence: maxScore > 5 ? 80 : (maxScore > 0 ? 50 : 0)
    };
}

/**
 * Gera instruções de System Prompt baseadas no perfil
 */
export function getPsychographicPromptInstructions(profile: PsychographicProfile): string {
    let instructions = `\n\n[REGRAS INTERNAS DE COMUNICAÇÃO - NÃO MENCIONAR AO CLIENTE]\n`;
    instructions += `⚠️ IMPORTANTE: Estas são diretrizes INTERNAS. NUNCA pergunte ao cliente sobre preferências de comunicação, perfil, ou estilo. Apenas ADAPTE sua comunicação naturalmente.\n\n`;

    // VAK Instructions - Implícitas
    if (profile.vakProfile === 'VISUAL') {
        instructions += `- Adapte: Use descrições visuais, palavras como 'veja', 'observe', 'imagine'. Seja objetivo e direto.\n`;
        instructions += `- Formato: Prefira listas curtas e tópicos organizados.\n`;
    } else if (profile.vakProfile === 'AUDITORY') {
        instructions += `- Adapte: Use linguagem conversacional, como se estivesse explicando verbalmente. Frases fluidas.\n`;
        instructions += `- Formato: Estruture como um diálogo natural com pontuação expressiva.\n`;
    } else if (profile.vakProfile === 'KINESTHETIC') {
        instructions += `- Adapte: Use palavras que transmitam segurança, conforto, experiência prática. Transmita calma.\n`;
        instructions += `- Formato: Use espaçamento generoso entre parágrafos para leitura confortável.\n`;
    }

    // Social Need Instructions - Implícitas (sem mencionar Chase Hughes)
    switch (profile.socialNeed) {
        case 'SIGNIFICANCE':
            instructions += `- Tom: Valorize as conquistas e impacto do cliente. Faça-o sentir-se especial e reconhecido.\n`;
            break;
        case 'ACCEPTANCE':
            instructions += `- Tom: Use 'nós', 'juntos', 'nossa parceria'. Enfatize comunidade e colaboração.\n`;
            break;
        case 'INTELLIGENCE':
            instructions += `- Tom: Apresente dados e fatos. Seja detalhado e lógico. Reconheça perguntas inteligentes.\n`;
            break;
        case 'APPROVAL':
            instructions += `- Tom: Valide e apoie o cliente. Se ele se autodepreciar, encoraje-o gentilmente.\n`;
            break;
        case 'PITY':
            instructions += `- Tom: Demonstre empatia genuína. Reconheça os desafios que ele enfrentou.\n`;
            break;
        case 'POWER':
            instructions += `- Tom: Ofereça opções para o cliente escolher. Deixe-o sentir que está no controle.\n`;
            break;
    }

    // Pace Instructions
    if (profile.communicationPace === 'SLOW') {
        instructions += `- Ritmo: Mantenha tom calmo e paciente. Não pressione.\n`;
    } else if (profile.communicationPace === 'FAST') {
        instructions += `- Ritmo: Seja breve e direto ao ponto.\n`;
    }

    // Técnicas gerais - sem mencionar nomes
    instructions += `- Use o nome do cliente para criar conexão pessoal.\n`;
    instructions += `- Em objeções, nunca confronte. Use: 'Talvez eu não tenha me explicado bem...'\n`;

    return instructions;
}
