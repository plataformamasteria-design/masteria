
import { analyzeProfile, getPsychographicPromptInstructions } from '../src/lib/neurolinguistics/profile-analyzer';

console.log("=== SUITE DE TESTES COMPLETOS: NEUROLINGUÍSTICA & CHASE HUGHES ===\n");

const testCases = [
    // --- VAK PROFILES ---
    {
        name: "VAK: VISUAL (Foco em imagem/ver)",
        text: "Eu vejo claramente que o cenário é brilhante. Mostre-me uma foto disso.",
        expectedVak: "VISUAL"
    },
    {
        name: "VAK: AUDITIVO (Foco em ouvir/som)",
        text: "Ouça o que eu digo, quero conversar sobre o tom dessa discussão.",
        expectedVak: "AUDITORY"
    },
    {
        name: "VAK: CINESTÉSICO (Foco em sentir/tocar)",
        text: "Sinto que isso pesa muito. Preciso de algo mais confortável e suave.",
        expectedVak: "KINESTHETIC"
    },

    // --- CHASE HUGHES SOCIAL NEEDS ---
    {
        name: "NEED: SIGNIFICÂNCIA (Eu, meu, sucesso, único)",
        text: "Eu quero deixar meu legado. Sou o único que conseguiu esse sucesso.",
        expectedNeed: "SIGNIFICANCE"
    },
    {
        name: "NEED: ACEITAÇÃO (Nós, equipe, juntos)",
        text: "Nós precisamos nos unir. A equipe e a família vão participar juntos.",
        expectedNeed: "ACCEPTANCE"
    },
    {
        name: "NEED: APROVAÇÃO (Desculpa, opinião, validação)",
        text: "Desculpa se estou errado, mas qual sua opinião? Espero não ter incomodado.",
        expectedNeed: "APPROVAL"
    },
    {
        name: "NEED: INTELIGÊNCIA (Lógica, dados, analisar)",
        text: "A lógica dos dados mostra que a teoria está correta. Analisei a pesquisa.",
        expectedNeed: "INTELLIGENCE"
    },
    {
        name: "NEED: PIEDADE/SOCORRO (Dor, difícil, ajuda)",
        text: "Está muito difícil, estou sofrendo com essa dor. Ninguém me ajuda.",
        expectedNeed: "PITY"
    },
    {
        name: "NEED: PODER (Controle, exigir, agora)",
        text: "Eu exijo ter o controle da situação agora. Eu decido quem manda aqui.",
        expectedNeed: "POWER"
    }
];

let passedCount = 0;
let totalCount = testCases.length;

testCases.forEach(test => {
    console.log(`\n[TESTE] ${test.name}`);
    console.log(`Input: "${test.text}"`);
    
    const profile = analyzeProfile(test.text);
    
    let passed = true;
    let failReason = "";

    // Check VAK if expected
    if (test.expectedVak) {
        if (profile.vakProfile !== test.expectedVak) {
            passed = false;
            failReason += ` | VAK Esperado: ${test.expectedVak}, Recebido: ${profile.vakProfile}`;
        }
    }

    // Check Need if expected
    if (test.expectedNeed) {
        if (profile.socialNeed !== test.expectedNeed) {
            passed = false;
            failReason += ` | Need Esperado: ${test.expectedNeed}, Recebido: ${profile.socialNeed}`;
        }
    }

    if (passed) {
        console.log("✅ PASSOU");
        passedCount++;
        // Log generated instructions to verify format
        const instructions = getPsychographicPromptInstructions(profile);
        console.log("   -> Instruções Geradas: " + instructions.split('\n')[2]); // Show first instruction line
    } else {
        console.log("❌ FALHOU" + failReason);
        console.log("   -> Profile Completo:", JSON.stringify(profile));
    }
});

console.log(`\n=== RESUMO ===`);
console.log(`Total: ${totalCount}`);
console.log(`Sucesso: ${passedCount}`);
console.log(`Falhas: ${totalCount - passedCount}`);

if (passedCount === totalCount) {
    console.log("\n✅ TODOS OS TESTES PASSARAM! O motor está calibrado.");
} else {
    console.log("\n⚠️ ALGUNS TESTES FALHARAM. Ajuste os pesos no profile-analyzer.ts.");
    process.exit(1);
}
