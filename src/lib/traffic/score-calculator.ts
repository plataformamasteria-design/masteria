/**
 * Ad Intelligence — Score Calculator
 * Calcula composite_score e alertas para criativos e audiências.
 */

interface ScoreInput {
  total_leads: number;
  qualified_leads: number;
  meetings_scheduled: number;
  meetings_held: number;
  contracts_closed: number;
  no_shows: number;
  avg_lead_score?: number;
}

interface ScoreResult {
  composite_score: number;
  alert_status: "ok" | "warning" | "critical" | "high_performer";
  alert_message: string | null;
}

export function calculateCompositeScore(input: ScoreInput): ScoreResult {
  const {
    total_leads, qualified_leads, meetings_scheduled,
    meetings_held, contracts_closed, no_shows,
    avg_lead_score = 50,
  } = input;

  const qualRate = total_leads > 0 ? qualified_leads / total_leads : 0;
  const meetRate = qualified_leads > 0 ? meetings_scheduled / qualified_leads : 0;
  const closeRate = meetings_held > 0 ? contracts_closed / meetings_held : 0;
  const noShowRate = meetings_scheduled > 0 ? no_shows / meetings_scheduled : 0;

  // Composite Score (0-100)
  const score = Math.round(
    ((qualRate * 0.25) + (meetRate * 0.30) + (closeRate * 0.35) + ((avg_lead_score / 100) * 0.10)) * 100 * 10
  ) / 10;

  // Alert logic
  let alert_status: ScoreResult["alert_status"] = "ok";
  let alert_message: string | null = null;

  // CRITICAL
  if (qualRate < 0.20 && total_leads >= 15) {
    alert_status = "critical";
    alert_message = `Taxa de qualificação de ${(qualRate * 100).toFixed(0)}% com ${total_leads} leads — criativo trazendo leads muito desqualificados. Pausar ou revisar copy/segmentação.`;
  } else if (meetRate < 0.10 && qualified_leads >= 10) {
    alert_status = "critical";
    alert_message = `Apenas ${(meetRate * 100).toFixed(0)}% dos qualificados agendam reunião — verificar follow-up do SDR.`;
  } else if (closeRate === 0 && meetings_held >= 5) {
    alert_status = "critical";
    alert_message = `Nenhum fechamento após ${meetings_held} reuniões — revisar pitch ou público.`;
  }
  // WARNING
  else if (qualRate >= 0.20 && qualRate < 0.35 && total_leads >= 10) {
    alert_status = "warning";
    alert_message = `Taxa de qualificação de ${(qualRate * 100).toFixed(0)}% — abaixo do esperado (ideal > 35%).`;
  } else if (noShowRate > 0.40 && meetings_scheduled >= 5) {
    alert_status = "warning";
    alert_message = `No-show de ${(noShowRate * 100).toFixed(0)}% — alto índice de ausência nos leads deste criativo.`;
  }
  // HIGH PERFORMER
  else if (score >= 70) {
    alert_status = "high_performer";
    alert_message = `Score de ${score} — top performer. Considerar aumentar budget em 20-30%.`;
  } else if (closeRate >= 0.30 && meetings_held >= 3) {
    alert_status = "high_performer";
    alert_message = `Taxa de fechamento de ${(closeRate * 100).toFixed(0)}% — alta conversão. Escalar verticalmente.`;
  } else if (qualRate >= 0.60 && total_leads >= 10) {
    alert_status = "high_performer";
    alert_message = `Qualificação de ${(qualRate * 100).toFixed(0)}% — criativo qualifica muito bem. Priorizar para SDR.`;
  }

  return { composite_score: Math.min(score, 100), alert_status, alert_message };
}
