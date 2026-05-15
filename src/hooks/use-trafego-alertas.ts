"use client";

import { useMemo, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";
import type { AdsMetadata, AdsPerformance } from "@/types/database";

export type AlertaSeveridade = "danger" | "warning";
export type AlertaTipo = "cpl_max" | "ctr_min" | "frequencia_max" | "zero_leads";

export interface AlertaUnificado {
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  msg: string;
  sugestao?: string;
  valor: string;
  threshold: string;
  // Raw values for sorting
  valorNum: number;
  thresholdNum: number;
}

interface AlertaThresholds {
  cplLimite: number;
  ctrMinimo: number;
  freqMaxima: number;
  zeroLeadsHoras: number;
  zeroLeadsGasto: number;
  ctrImpMin: number;
  cplAtivo: boolean;
  ctrAtivo: boolean;
  freqAtivo: boolean;
  zeroAtivo: boolean;
}

function loadThresholds(): AlertaThresholds {
  if (typeof window === "undefined") {
    return { cplLimite: 100, ctrMinimo: 0.8, freqMaxima: 3, zeroLeadsHoras: 48, zeroLeadsGasto: 50, ctrImpMin: 500, cplAtivo: true, ctrAtivo: true, freqAtivo: true, zeroAtivo: true };
  }
  return {
    cplLimite: Number(localStorage.getItem("trafego_cpl_limite") || "100"),
    ctrMinimo: Number(localStorage.getItem("trafego_ctr_minimo") || "0.8"),
    freqMaxima: Number(localStorage.getItem("trafego_freq_maxima") || "3"),
    zeroLeadsHoras: Number(localStorage.getItem("trafego_zero_horas") || "48"),
    zeroLeadsGasto: Number(localStorage.getItem("trafego_zero_gasto") || "50"),
    ctrImpMin: Number(localStorage.getItem("trafego_ctr_imp_min") || "500"),
    cplAtivo: localStorage.getItem("trafego_cpl_ativo") !== "false",
    ctrAtivo: localStorage.getItem("trafego_ctr_ativo") !== "false",
    freqAtivo: localStorage.getItem("trafego_freq_ativo") !== "false",
    zeroAtivo: localStorage.getItem("trafego_zero_ativo") !== "false",
  };
}

export function gerarAlertas(
  metadata: AdsMetadata[],
  performance: AdsPerformance[],
  thresholds: AlertaThresholds,
  snoozedIds?: Set<string>,
): AlertaUnificado[] {
  const d3 = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const d2 = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const alertas: AlertaUnificado[] = [];

  for (const ad of metadata) {
    const perfs = performance.filter((p) => p.ad_id === ad.ad_id);
    const totalLeads = perfs.reduce((s, p) => s + p.leads, 0);
    const spend = perfs.reduce((s, p) => s + Number(p.spend), 0);
    const cpl = totalLeads > 0 ? spend / totalLeads : 0;

    const perfs3d = perfs.filter((p) => p.data_ref >= d3);
    const imp3d = perfs3d.reduce((s, p) => s + p.impressoes, 0);
    const clk3d = perfs3d.reduce((s, p) => s + p.cliques, 0);
    const ctr3d = imp3d > 0 ? (clk3d / imp3d) * 100 : 0;

    const perfs7d = perfs.filter((p) => p.data_ref >= d7 && p.frequencia > 0);
    const freqMedia = perfs7d.length > 0 ? perfs7d.reduce((s, p) => s + p.frequencia, 0) / perfs7d.length : 0;

    const perfs2d = perfs.filter((p) => p.data_ref >= d2);
    const spend2d = perfs2d.reduce((s, p) => s + Number(p.spend), 0);
    const leads2d = perfs2d.reduce((s, p) => s + p.leads, 0);

    const isSnoozed = (tipo: string) => snoozedIds?.has(`${ad.ad_id}:${tipo}`) ?? false;

    if (thresholds.cplAtivo && cpl > thresholds.cplLimite && totalLeads > 0 && !isSnoozed("cpl_max")) {
      alertas.push({
        ad_id: ad.ad_id, ad_name: ad.ad_name, adset_id: ad.adset_id, campaign_id: ad.campaign_id, campaign_name: ad.campaign_name,
        tipo: "cpl_max", severidade: "danger",
        msg: `CPL de ${formatCurrency(cpl)} — acima de ${formatCurrency(thresholds.cplLimite)}`,
        valor: formatCurrency(cpl), threshold: formatCurrency(thresholds.cplLimite),
        valorNum: cpl, thresholdNum: thresholds.cplLimite,
      });
    }

    if (thresholds.ctrAtivo && ctr3d < thresholds.ctrMinimo && imp3d > thresholds.ctrImpMin && !isSnoozed("ctr_min")) {
      alertas.push({
        ad_id: ad.ad_id, ad_name: ad.ad_name, adset_id: ad.adset_id, campaign_id: ad.campaign_id, campaign_name: ad.campaign_name,
        tipo: "ctr_min", severidade: "warning",
        msg: `CTR de ${ctr3d.toFixed(2)}% nos últimos 3 dias`,
        sugestao: "Revisar criativo, headline ou CTA.",
        valor: ctr3d.toFixed(2) + "%", threshold: thresholds.ctrMinimo + "%",
        valorNum: ctr3d, thresholdNum: thresholds.ctrMinimo,
      });
    }

    if (thresholds.freqAtivo && freqMedia > thresholds.freqMaxima && !isSnoozed("frequencia_max")) {
      alertas.push({
        ad_id: ad.ad_id, ad_name: ad.ad_name, adset_id: ad.adset_id, campaign_id: ad.campaign_id, campaign_name: ad.campaign_name,
        tipo: "frequencia_max", severidade: "warning",
        msg: `Frequência de ${freqMedia.toFixed(1)}x — audiência saturada`,
        sugestao: "Rotacionar criativo ou expandir audiência.",
        valor: freqMedia.toFixed(1) + "x", threshold: thresholds.freqMaxima + "x",
        valorNum: freqMedia, thresholdNum: thresholds.freqMaxima,
      });
    }

    if (thresholds.zeroAtivo && spend2d > thresholds.zeroLeadsGasto && leads2d === 0 && !isSnoozed("zero_leads")) {
      alertas.push({
        ad_id: ad.ad_id, ad_name: ad.ad_name, adset_id: ad.adset_id, campaign_id: ad.campaign_id, campaign_name: ad.campaign_name,
        tipo: "zero_leads", severidade: "danger",
        msg: `Zero leads com R$ ${spend2d.toFixed(2)} gastos`,
        sugestao: "Verificar formulário ou segmentação.",
        valor: `R$ ${spend2d.toFixed(2)}`, threshold: `0 leads / ${thresholds.zeroLeadsHoras}h`,
        valorNum: spend2d, thresholdNum: thresholds.zeroLeadsGasto,
      });
    }
  }

  // Sort: danger first, then by how far above threshold
  alertas.sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === "danger" ? -1 : 1;
    if (a.tipo === "cpl_max" && b.tipo === "cpl_max") return b.valorNum - a.valorNum;
    return 0;
  });

  return alertas;
}

export function useTrafegoAlertas(metadata: AdsMetadata[], performance: AdsPerformance[], isDataLoading: boolean) {
  const [thresholds, setThresholds] = useState<AlertaThresholds | null>(null);

  useEffect(() => {
    setThresholds(loadThresholds());
  }, []);

  const alertas = useMemo(() => {
    if (!thresholds || isDataLoading) return [];
    return gerarAlertas(metadata, performance, thresholds);
  }, [metadata, performance, thresholds, isDataLoading]);

  const criticos = useMemo(() => alertas.filter((a) => a.severidade === "danger"), [alertas]);
  const avisos = useMemo(() => alertas.filter((a) => a.severidade === "warning"), [alertas]);

  return {
    alertas,
    criticos,
    avisos,
    totalAlertas: alertas.length,
    totalCriticos: criticos.length,
    isLoading: isDataLoading || thresholds === null,
  };
}
