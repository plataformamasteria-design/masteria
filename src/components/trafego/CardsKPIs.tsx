"use client";

import { useState, useEffect, useCallback } from "react";
import { CardKPI } from "./CardKPI";
import { cn } from "@/lib/utils";

interface CardsKPIsProps {
  mesReferencia: string;
  dataInicio?: string;
  dataFim?: string;
  accountId?: string | null;
}

export function CardsKPIs({ mesReferencia, dataInicio, dataFim, accountId }: CardsKPIsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchKpis = useCallback(async () => {
    const m = "midia";
    setLoading(true);
    try {
      let since = "";
      let until = "";
      
      if (dataInicio && dataFim) {
        since = dataInicio;
        until = dataFim;
      } else if (mesReferencia) {
        since = `${mesReferencia}-01`;
        const [y, mo] = mesReferencia.split("-");
        const ld = new Date(Number(y), Number(mo), 0).getDate();
        until = `${mesReferencia}-${ld}`;
      }

      const promises = [
        fetch(`/api/marketing/kpis-trafego?mesReferencia=${mesReferencia}&modo=${m}${dataInicio && dataFim ? `&since=${dataInicio}&until=${dataFim}` : ""}`).then(r => r.json())
      ];

      if (accountId && since && until) {
        const metaParams = new URLSearchParams({
          since,
          until,
          level: "campaign",
          breakdown: "none",
          account_id: accountId
        });
        promises.push(fetch(`/api/meta/insights?${metaParams}`).then(r => r.ok ? r.json() : null));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [json, metaRes] = await Promise.all(promises);

      if (!json.error && metaRes?.totals) {
        const meta = metaRes.totals;
        const safe = (n: number, d: number) => (d && d > 0 ? n / d : null);
        const findC = (id: string) => json.cards.find((c: any) => c.id === id);
        const setV = (id: string, val: number | null) => { const c = findC(id); if (c) c.valor = val; };
        
        const inv = meta.spend || 0;
        const leads = meta.leads || 0;
        const imp = meta.impressions || 0;
        const cli = meta.clicks || 0;

        if (m === "midia") {
          setV("investimento", inv);
          setV("leads", leads);
          setV("impressoes", imp);
          
          const ctr = safe(cli, imp);
          const cpc = safe(inv, cli);
          const cpl = safe(inv, leads);
          const cpm = imp > 0 ? (inv * 1000) / imp : null;
          
          setV("ctr", ctr ? ctr * 100 : null);
          setV("cpc", cpc);
          setV("cpl", cpl);
          setV("cpm", cpm);
        } else if (m === "funil") {
          const cprfCard = findC("cprf");
          const reuniRe = findC("reunioes_realizadas")?.valor || 0;
          if (cprfCard) cprfCard.valor = safe(inv, reuniRe);
        } else if (m === "receita") {
          const cacCard = findC("cac_bruto");
          const roasCard = findC("roas_bruto");
          const clientes = findC("clientes_fechados")?.valor || 0;
          const mrr = findC("mrr_gerado")?.valor || 0;
          if (cacCard) cacCard.valor = safe(inv, clientes);
          if (roasCard) roasCard.valor = safe(mrr, inv);
        }
      }

      if (!json.error) setData(json);
    } catch (err) {
      console.error("[CardsKPIs] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [mesReferencia, dataInicio, dataFim, accountId]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const cards = data?.cards || [];
  const atribuicaoCompleta = data?.atribuicao_completa ?? true;

  return (
    <div>
      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity duration-200">
        {loading
          ? Array.from({ length: 10 }).map((_, i) => (
              <CardKPI
                key={i}
                id=""
                label=""
                valor={null}
                tipo="inteiro"
                tendencia={{ valor_anterior: null, variacao_pct: null, direcao: "flat" }}
                tooltip=""
                fonte=""
                requer_atribuicao={false}
                atribuicaoCompleta={true}
                loading
              />
            ))
          : cards.map((card: any) => (
              <CardKPI
                key={card.id}
                {...card}
                atribuicaoCompleta={atribuicaoCompleta}
              />
            ))
        }
      </div>
    </div>
  );
}

