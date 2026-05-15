import fs from 'fs/promises';
import path from 'path';

async function generateReport() {
  try {
    const dataPath = path.join(process.cwd(), 'scratch_analysis_results.json');
    const rawData = await fs.readFile(dataPath, 'utf-8');
    const results = JSON.parse(rawData);

    let totalAnalised = results.length;
    let lostSales = 0;
    
    let abandonmentCounts: Record<string, number> = {
      NONE: 0, NO_RESPONSE: 0, PRICE_OBJECTION: 0, DOUBT: 0, LACK_OF_INFO: 0, DISSATISFACTION: 0, OTHER: 0
    };
    
    let dissatisfactions: string[] = [];
    let objections: string[] = [];
    let summaries: string[] = [];

    for (const item of results) {
      const { analysis } = item;
      
      if (analysis.wasLostSale) {
        lostSales++;
      }
      
      if (analysis.abandonmentPoint && abandonmentCounts[analysis.abandonmentPoint] !== undefined) {
        abandonmentCounts[analysis.abandonmentPoint]++;
      } else if (analysis.abandonmentPoint) {
         abandonmentCounts['OTHER']++;
      }

      if (analysis.dissatisfactionReason) {
        dissatisfactions.push(analysis.dissatisfactionReason);
      }

      if (analysis.keyObjection) {
        objections.push(analysis.keyObjection);
      }
      
      if (analysis.wasLostSale && analysis.summary) {
        summaries.push(analysis.summary);
      }
    }

    const conversionLossRate = totalAnalised > 0 ? ((lostSales / totalAnalised) * 100).toFixed(2) : '0';

    let markdown = `# Relatório MAX: Análise de Vendas e Retenção - Henrique Felipe Alves

## Resumo Executivo
- **Conversas Analisadas:** ${totalAnalised}
- **Vendas Perdidas / Abandonos:** ${lostSales} (${conversionLossRate}%)

---

## 📉 Momentos de Abandono
Onde o lead desistiu de continuar a conversa:
- 😶 **Sem Resposta (Ghosting):** ${abandonmentCounts.NO_RESPONSE}
- 💰 **Objeção de Preço:** ${abandonmentCounts.PRICE_OBJECTION}
- ❓ **Dúvida Não Esclarecida:** ${abandonmentCounts.DOUBT}
- ℹ️ **Falta de Informação:** ${abandonmentCounts.LACK_OF_INFO}
- 😠 **Insatisfação:** ${abandonmentCounts.DISSATISFACTION}
- 🔄 **Outros Motivos:** ${abandonmentCounts.OTHER}

---

## ⚠️ Motivos de Insatisfação Identificados
*Abaixo estão os principais relatos ou padrões de insatisfação identificados pela IA ao longo das ${totalAnalised} conversas:*

`;

    // Add unique dissatisfactions (limit to 15 to avoid massive walls of text)
    const uniqueDissatisfactions = [...new Set(dissatisfactions)].filter(d => d.length > 5).slice(0, 15);
    if (uniqueDissatisfactions.length > 0) {
      uniqueDissatisfactions.forEach(d => markdown += `- ${d}\n`);
    } else {
      markdown += `- Nenhuma insatisfação explícita registrada nos dados analisados.\n`;
    }

    markdown += `\n---

## 🛡️ Principais Objeções
*As maiores barreiras levantadas pelos leads antes de abandonarem a conversa:*

`;

    const uniqueObjections = [...new Set(objections)].filter(o => o.length > 5).slice(0, 15);
    if (uniqueObjections.length > 0) {
      uniqueObjections.forEach(o => markdown += `- ${o}\n`);
    } else {
      markdown += `- Nenhuma objeção explícita registrada.\n`;
    }

    markdown += `\n---

## 🔍 Exemplos de Cenários de Perda
*Resumo de algumas interações onde a venda foi perdida, para análise de melhoria:*

`;

    // Limit to 10 representative summaries
    const sampleSummaries = summaries.slice(0, 10);
    if (sampleSummaries.length > 0) {
      sampleSummaries.forEach(s => markdown += `- ${s}\n`);
    } else {
      markdown += `- Sem resumos disponíveis.\n`;
    }

    markdown += `\n---

## 🎯 Conclusão e Pontos de Ajuste (Insight IA)
Com base na varredura completa do funil de atendimento, os gargalos de performance parecem se concentrar em:

1. **${abandonmentCounts.NO_RESPONSE > lostSales * 0.4 ? 'Alto índice de Ghosting' : 'Falta de Engajamento'}:** Muitos leads param de responder. É necessário criar gatilhos de engajamento (perguntas abertas) ao invés de apenas enviar informações estáticas.
2. **Objeções não tratadas:** Objeções como preço ou dúvidas estão paralisando a venda. A IA (ou atendentes) precisa ter um roteiro (playbook) de contorno de objeções mais agressivo e humano.
3. **Tempo de Resposta/Clareza:** Verificar se a falta de informação (\\\`${abandonmentCounts.LACK_OF_INFO}\\\`) ocorre por falha da base de conhecimento da IA ou atraso no atendimento humano.

*Relatório gerado automaticamente analisando o histórico completo de mensagens do banco de dados.*
`;

    // Guardar no artifact
    const artifactPath = path.join('C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\7fcd366c-3ace-4776-b2ce-42e8efef62f9', 'relatorio_max_vendas.md');
    await fs.writeFile(artifactPath, markdown);
    console.log(`Relatório final gerado com sucesso: ${artifactPath}`);

  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
  }
}

generateReport();
