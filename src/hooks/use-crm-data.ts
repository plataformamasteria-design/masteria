"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { supabase } from "@/lib/supabase";
import type { LeadCrm, Closer, Sdr, Contrato } from "@/types/database";
import { toast } from "sonner";

const FETCH_SIZE = 1000;

export interface CrmDataReturn {
    leads: LeadCrm[];
    closers: Closer[];
    sdrs: Sdr[];
    contratosMap: Record<string, Contrato>;
    loading: boolean;
    error: string | null;
    mutate: () => void;
    updateLead: (id: string, campo: keyof LeadCrm, valor: any) => Promise<void>;
    mudarEtapa: (id: string, novaEtapa: string) => Promise<void>;
    addNovoLead: (etapa: string, mesRef: string, extra?: { nome?: string; telefone?: string; email?: string; ghl_contact_id?: string; lead_avulso?: boolean; fonte_avulso?: string; origem_tipo?: string; ad_id_vinculado?: string; atribuicao_tier?: number }) => Promise<LeadCrm | null>;
    deleteLead: (id: string) => Promise<void>;
    loadMore: () => Promise<void>;
    hasMore: boolean;
    totalCount: number;
    loadingMore: boolean;
}

export function useCrmData(mesRef?: string): CrmDataReturn {
    const [allLeads, setAllLeads] = useState<LeadCrm[]>([]);
    const [contratosMap, setContratosMap] = useState<Record<string, Contrato>>({});
    const [hasMore, setHasMore] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const cursorRef = useRef<{ ghl_created_at: string | null; id: string } | null>(null);

    const [crmError, setCrmError] = useState<string | null>(null);

    const { data, error: swrError, mutate } = useSWR(
        ["crm-data", mesRef || "all"],
        async () => {
            try {
                // Etapas ativas do funil que devem aparecer independente do mês
                const ETAPAS_SEMPRE_VISIVEIS = [
                    "reuniao_agendada", "proposta_enviada", "no_show",
                    "assinatura_contrato", "negociacao",
                ];

                // Query com filtro de mês + query de etapas ativas (qualquer mês)
                let leadsQuery = supabase.from("leads_crm").select("*")
                    .order("ghl_created_at", { ascending: false, nullsFirst: false })
                    .order("id", { ascending: false });
                let countQuery = supabase.from("leads_crm").select("id", { count: "exact", head: true });

                let fetchEtapasAtivas = false;

                if (mesRef && mesRef !== "all") {
                    leadsQuery = leadsQuery.eq("mes_referencia", mesRef);
                    countQuery = countQuery.eq("mes_referencia", mesRef);
                    fetchEtapasAtivas = true;
                } else {
                    leadsQuery = leadsQuery.limit(FETCH_SIZE);
                }

                const [{ count }, { data: l, error: e1 }, { data: c, error: e2 }, { data: s, error: e3 }] = await Promise.all([
                    countQuery,
                    leadsQuery,
                    supabase.from("closers").select("*").eq("ativo", true).order("nome"),
                    supabase.from("sdrs").select("*").eq("ativo", true).order("nome"),
                ]);

                // Buscar leads em etapas ativas de outros meses
                let etapasAtivasData: LeadCrm[] = [];
                if (fetchEtapasAtivas && mesRef) {
                    const { data: ea } = await supabase.from("leads_crm").select("*")
                        .in("etapa", ETAPAS_SEMPRE_VISIVEIS)
                        .neq("mes_referencia", mesRef)
                        .order("ghl_created_at", { ascending: false, nullsFirst: false });
                    etapasAtivasData = (ea || []) as LeadCrm[];
                }

                if (e1) console.error("CRM leads error:", e1.message);
                if (e2) console.error("CRM closers error:", e2.message);
                if (e3) console.error("CRM sdrs error:", e3.message);

                // Mesclar: leads do mês + leads em etapas ativas de outros meses (sem duplicatas)
                const mesLeads = (l || []) as LeadCrm[];
                const seenIds = new Set(mesLeads.map((lead: LeadCrm) => lead.id));
                const extras = (etapasAtivasData as LeadCrm[]).filter((lead: LeadCrm) => !seenIds.has(lead.id));
                const leads = [...mesLeads, ...extras];
                const total = (count || 0) + extras.length;

                if (leads.length > 0) {
                    const last = leads[leads.length - 1];
                    cursorRef.current = { ghl_created_at: last.ghl_created_at, id: last.id };
                } else {
                    cursorRef.current = null;
                }

                setAllLeads(leads);
                setTotalCount(total);
                setHasMore(leads.length < total);
                setCrmError(null);

                return { closers: (c || []) as Closer[], sdrs: (s || []) as Sdr[] };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error("CRM data fetch failed:", msg);
                setCrmError(msg);
                // Retornar dados vazios para que loading não fique infinito
                return { closers: [] as Closer[], sdrs: [] as Sdr[] };
            }
        },
        { revalidateOnFocus: false, dedupingInterval: 5000 }
    );

    const closers = data?.closers || [];
    const sdrs = data?.sdrs || [];
    const loading = !data && !swrError && !crmError;

    // Batch-fetch contratos for leads that have contrato_id
    const contratosMapRef = useRef(contratosMap);
    contratosMapRef.current = contratosMap;

    const fetchContratos = useCallback(async (leads: LeadCrm[]) => {
        const ids = leads.map((l) => l.contrato_id).filter(Boolean) as string[];
        const newIds = ids.filter((id) => !contratosMapRef.current[id]);

        // Leads "comprou" sem contrato_id — buscar por lead_id (contrato criado pelo sync)
        const leadsComprouSemContrato = leads.filter(
            (l) => l.etapa === "comprou" && !l.contrato_id
        );

        const [byIdRes, byLeadRes] = await Promise.all([
            newIds.length > 0
                ? supabase.from("contratos")
                    .select("id, lead_id, data_fechamento, mrr, valor_entrada, valor_total_projeto, meses_contrato, cliente_nome, mensalidades_variaveis, status, sinal_pago, sinal_valor, restante_pago")
                    .in("id", newIds)
                : Promise.resolve({ data: [] }),
            leadsComprouSemContrato.length > 0
                ? supabase.from("contratos")
                    .select("id, lead_id, data_fechamento, mrr, valor_entrada, valor_total_projeto, meses_contrato, cliente_nome, mensalidades_variaveis, status, sinal_pago, sinal_valor, restante_pago")
                    .in("lead_id", leadsComprouSemContrato.map((l) => l.id))
                : Promise.resolve({ data: [] }),
        ]);

        const allContratos = [...(byIdRes.data || []), ...(byLeadRes.data || [])];
        if (allContratos.length === 0) return;

        setContratosMap((prev) => {
            const next = { ...prev };
            for (const c of allContratos) next[c.id] = c as Contrato;
            return next;
        });

        // Vincular contrato_id nos leads que não tinham (atualização otimista + persist)
        for (const c of byLeadRes.data || []) {
            if (c.lead_id) {
                const lead = leadsComprouSemContrato.find((l) => l.id === c.lead_id);
                if (lead && !lead.contrato_id) {
                    setAllLeads((prev) => prev.map((l) => l.id === c.lead_id ? { ...l, contrato_id: c.id } : l));
                    fetch("/api/crm/leads", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "update", id: c.lead_id, updates: { contrato_id: c.id } }),
                    }).catch((err) => console.error("Erro ao vincular contrato:", err));
                }
            }
        }
    }, []);

    // Fetch contratos whenever allLeads changes
    useEffect(() => {
        if (allLeads.length > 0) fetchContratos(allLeads);
    }, [allLeads]); // eslint-disable-line react-hooks/exhaustive-deps

    // Carregar mais leads (cursor-based)
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || !cursorRef.current) return;
        setLoadingMore(true);
        try {
            const cursor = cursorRef.current;
            let query = supabase
                .from("leads_crm")
                .select("*")
                .order("ghl_created_at", { ascending: false, nullsFirst: false })
                .order("id", { ascending: false })
                .limit(FETCH_SIZE);

            // Aplicar filtro de mês para consistência com o fetch inicial
            if (mesRef && mesRef !== "all") {
                query = query.eq("mes_referencia", mesRef);
            }

            if (cursor.ghl_created_at) {
                query = query.or(`ghl_created_at.lt.${cursor.ghl_created_at},and(ghl_created_at.eq.${cursor.ghl_created_at},id.lt.${cursor.id})`);
            } else {
                query = query.lt("id", cursor.id);
            }

            const { data: newLeads } = await query;
            const batch = (newLeads || []) as LeadCrm[];

            if (batch.length > 0) {
                const last = batch[batch.length - 1];
                cursorRef.current = { ghl_created_at: last.ghl_created_at, id: last.id };
                setAllLeads((prev) => {
                    const existingIds = new Set(prev.map((l) => l.id));
                    const unique = batch.filter((l) => !existingIds.has(l.id));
                    return [...prev, ...unique];
                });
            }
            if (batch.length < FETCH_SIZE) setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, mesRef]);

    // Real-time: update granular sem recarregar tudo
    useEffect(() => {
        const ch = supabase.channel("leads_crm_rt3")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads_crm" }, (payload) => {
                const newLead = payload.new as LeadCrm;
                if (!newLead?.id) return;
                // Só adicionar se pertence ao mês filtrado (ou sem filtro)
                if (mesRef && mesRef !== "all" && newLead.mes_referencia !== mesRef) return;
                setAllLeads((prev) => {
                    if (prev.some((l) => l.id === newLead.id)) return prev;
                    return [newLead, ...prev];
                });
                setTotalCount((c) => c + 1);
            })
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads_crm" }, (payload) => {
                const updated = payload.new as LeadCrm;
                if (!updated?.id) return;
                setAllLeads((prev) => {
                    const idx = prev.findIndex((l) => l.id === updated.id);
                    if (idx === -1) return prev;
                    const next = [...prev];
                    next[idx] = { ...prev[idx], ...updated };
                    return next;
                });
            })
            .on("postgres_changes", { event: "DELETE", schema: "public", table: "leads_crm" }, (payload) => {
                const old = payload.old as { id?: string };
                if (!old?.id) return;
                setAllLeads((prev) => prev.filter((l) => l.id !== old.id));
                setTotalCount((c) => Math.max(0, c - 1));
            })
            .on("postgres_changes", { event: "*", schema: "public", table: "contratos" }, (payload) => {
                if (payload.eventType === "DELETE") return;
                const c = payload.new as Contrato;
                if (!c?.id) return;
                setContratosMap((prev) => ({ ...prev, [c.id]: c }));
            })
            .subscribe();

        return () => { supabase.removeChannel(ch); };
    }, [mesRef]);

    // Mapa de campos do lead → campo equivalente no contrato
    const LEAD_TO_CONTRATO: Record<string, string> = {
        nome: "cliente_nome",
        mensalidade: "mrr",
        valor_entrada: "valor_entrada",
        fidelidade_meses: "meses_contrato",
        closer_id: "closer_id",
        sdr_id: "sdr_id",
        canal_aquisicao: "origem_lead",
        data_venda: "data_fechamento",
        mensalidades_variaveis: "mensalidades_variaveis",
    };

    // Propagar silenciosamente para contrato pendente_aprovacao
    const propagarParaContrato = useCallback(async (leadId: string, campos: Record<string, unknown>) => {
        const lead = allLeads.find((l) => l.id === leadId);
        if (!lead?.contrato_id) return;
        const contrato = contratosMap[lead.contrato_id];
        if (!contrato || contrato.status !== "pendente_aprovacao") return;

        const hasVarMensal = !!(lead as any).mensalidades_variaveis?.length;
        const contratoUpdates: Record<string, unknown> = {};
        for (const [leadCol, val] of Object.entries(campos)) {
            if (hasVarMensal && (leadCol === "valor_entrada" || leadCol === "mensalidade")) continue;
            const ctCol = LEAD_TO_CONTRATO[leadCol];
            if (ctCol) contratoUpdates[ctCol] = val;
        }
        if (Object.keys(contratoUpdates).length === 0) return;

        try {
            await fetch("/api/crm/leads", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "table_update", table: "contratos", id: lead.contrato_id, updates: contratoUpdates }),
            });
        } catch {}
    }, [allLeads, contratosMap]);

    const updateLead = useCallback(async (id: string, campo: keyof LeadCrm, valor: any) => {
        const oldLead = allLeads.find((l) => l.id === id);
        if (!oldLead) return;

        // Mutação Otimista
        setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));

        const res = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", id, updates: { [campo]: valor } }),
        });
        const json = await res.json();
        if (!json.ok) {
            setAllLeads((prev) => prev.map((l) => (l.id === id ? oldLead : l)));
            toast.error("Erro ao salvar o lead no banco.");
            return;
        }

        // Auto-cálculo à vista: se mudou entrada ou meses e mensalidade é 0, calcular média
        if (campo === "valor_entrada" || campo === "fidelidade_meses") {
            const ent = campo === "valor_entrada" ? Number(valor) : Number(oldLead.valor_entrada) || 0;
            const mes = campo === "fidelidade_meses" ? Number(valor) : Number(oldLead.fidelidade_meses) || 0;
            const mensal = Number(oldLead.mensalidade) || 0;
            const hasVarMensal = !!(oldLead as any).mensalidades_variaveis?.length;
            if (ent > 0 && mes > 0 && mensal <= 0 && !hasVarMensal) {
                const mediaCalc = Math.round((ent / mes) * 100) / 100;
                const ltvCalc = ent;
                // Batch: atualizar lead + propagar tudo de uma vez
                const batchUpdates = { mensalidade: mediaCalc, valor_total_projeto: ltvCalc };
                setAllLeads((prev) => prev.map((l) => l.id === id ? { ...l, ...batchUpdates } : l));
                fetch("/api/crm/leads", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update", id, updates: batchUpdates }),
                }).catch(() => {});
                // Propagar campo original + derivados para contrato (silencioso)
                propagarParaContrato(id, { [campo]: valor, ...batchUpdates });
                return; // Não propagar novamente abaixo
            }
        }

        // Propagar campo individual para contrato (silencioso, sem toast)
        propagarParaContrato(id, { [campo]: valor });
    }, [allLeads, propagarParaContrato]);

    const mudarEtapa = useCallback(async (id: string, novaEtapa: string) => {
        const lead = allLeads.find((l) => l.id === id);
        if (!lead) return;

        const agora = new Date().toISOString();
        const df: Record<string, string> = { reuniao_agendada: "data_reuniao_agendada", proposta_enviada: "data_proposta_enviada", follow_up: "data_follow_up", assinatura_contrato: "data_assinatura", comprou: "data_comprou", desistiu: "data_desistiu" };
        const upd: Partial<LeadCrm> = { etapa: novaEtapa as LeadCrm["etapa"] };
        if (df[novaEtapa]) (upd as any)[df[novaEtapa]] = agora;
        if (novaEtapa === "comprou") {
            upd.data_venda = agora.split("T")[0];
            // Atualizar mes_referencia para o mês da venda (mês atual)
            upd.mes_referencia = agora.slice(0, 7);
        }

        // Mutação otimista
        setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...upd } : l)));

        // Persistir etapa PRIMEIRO — se falhar, rollback e não cria registros órfãos
        const etapaRes = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", id, updates: upd }),
        });
        const etapaJson = await etapaRes.json();
        if (!etapaJson.ok) {
            setAllLeads((prev) => prev.map((l) => (l.id === id ? lead : l)));
            toast.error("Tentativa falhou. Rollback revertendo o visual.");
            return;
        }

        fetch("/api/crm/leads", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "table_insert", table: "leads_crm_historico", payload: { lead_id: id, etapa_anterior: lead.etapa, etapa_nova: novaEtapa } }),
        }).catch(() => {});

        // Auto Contrato — só após persistência da etapa garantida
        if (novaEtapa === "comprou" && lead.etapa !== "comprou") {
            try {
                // Verificar se já existe contrato para este lead (evita duplicata)
                const { data: existente } = await supabase
                    .from("contratos")
                    .select("id")
                    .or(`lead_id.eq.${id}${lead.contrato_id ? `,id.eq.${lead.contrato_id}` : ""}`)
                    .neq("status", "cancelado")
                    .limit(1);

                if (existente && existente.length > 0) {
                    // Já existe contrato — vincular se não estiver vinculado
                    if (!lead.contrato_id) {
                        await fetch("/api/crm/leads", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "update", id, updates: { contrato_id: existente[0].id } }),
                        });
                        setAllLeads((prev) => prev.map((l) => l.id === id ? { ...l, contrato_id: existente[0].id } : l));
                    }
                    toast.success("Lead marcado como comprou (contrato já existia)");
                    globalMutate((key) => Array.isArray(key) && key[0] === 'dashboard-db');
                    return; // Sai sem criar duplicata
                }

                const mensalidadesVarContrato = (lead as any).mensalidades_variaveis as number[] | null;
                const hasVarMensal = mensalidadesVarContrato && mensalidadesVarContrato.length > 0;
                const mesesLead = Number(lead.fidelidade_meses) || 6;
                const entradaLead = Number(lead.valor_entrada) || 0;
                const mensalidadeLead = Number(lead.mensalidade) || 0;

                // Determinar cenário:
                // 1. Mensalidades variáveis → MRR = média, LTV = soma
                // 2. Só entrada + meses (sem mensalidade) → à vista. MRR = entrada/meses, LTV = entrada
                // 3. Mensalidade preenchida → fluxo normal
                let mrr: number;
                let entrada: number;
                let meses: number;
                let entradaPrimeiroMes: boolean;
                let obs = "";

                if (hasVarMensal) {
                    // Cenário 1: mensalidades variáveis
                    // Entrada = 1ª mensalidade, MRR = média das restantes
                    meses = mensalidadesVarContrato.length;
                    entrada = mensalidadesVarContrato[0] || 0;
                    const restantes = mensalidadesVarContrato.slice(1);
                    mrr = restantes.length > 0 ? Math.round((restantes.reduce((s, v) => s + v, 0) / restantes.length) * 100) / 100 : 0;
                    entradaPrimeiroMes = true;
                    obs = `Mensalidades variáveis: ${mensalidadesVarContrato.map(v => `R$${v}`).join(", ")}`;
                } else if (entradaLead > 0 && mensalidadeLead <= 0) {
                    // Cenário 2: à vista — GENERATED com e1m=true: entrada + mrr*(meses-1) = total
                    meses = mesesLead;
                    const mensal = Math.round((entradaLead / meses) * 100) / 100;
                    if (meses > 1) {
                        mrr = Math.round(((entradaLead - mensal) / (meses - 1)) * 100) / 100;
                        entrada = Math.round((entradaLead - mrr * (meses - 1)) * 100) / 100;
                    } else {
                        mrr = entradaLead;
                        entrada = entradaLead;
                    }
                    entradaPrimeiroMes = true;
                    obs = `Pago à vista: R$${entradaLead.toFixed(2)}`;
                } else {
                    // Cenário 3: fluxo normal com mensalidade
                    meses = mesesLead;
                    mrr = mensalidadeLead;
                    entrada = entradaLead;
                    entradaPrimeiroMes = true;
                }

                // Calcular LTV para salvar no contrato
                let ltvContrato: number;
                if (hasVarMensal) {
                    ltvContrato = mensalidadesVarContrato!.reduce((s, v) => s + (v || 0), 0);
                } else {
                    ltvContrato = entradaPrimeiroMes
                        ? entrada + mrr * Math.max(0, meses - 1)
                        : entrada + mrr * meses;
                }

                const contratoPayload: Record<string, unknown> = {
                    mes_referencia: lead.mes_referencia || agora.slice(0, 7),
                    closer_id: lead.closer_id || null,
                    sdr_id: lead.sdr_id || null,
                    cliente_nome: lead.nome || "Sem nome",
                    origem_lead: lead.instagram ? "Instagram" : (lead.canal_aquisicao || lead.funil || "—"),
                    valor_entrada: entrada,
                    meses_contrato: meses,
                    mrr,
                    valor_total_projeto: ltvContrato,
                    entrada_e_primeiro_mes: entradaPrimeiroMes,
                    status: "pendente_aprovacao",
                    data_fechamento: agora.split("T")[0],
                    obs,
                    lead_id: id,
                };
                if (hasVarMensal) {
                    contratoPayload.mensalidades_variaveis = mensalidadesVarContrato;
                }
                const contratoRes = await fetch("/api/crm/leads", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "table_insert", table: "contratos", select: true,
                        payload: contratoPayload,
                    }),
                });
                const contratoJson = await contratoRes.json();
                if (!contratoJson.ok) throw new Error(contratoJson.error);
                const contrato = contratoJson.data;

                if (contrato?.id) {
                    await fetch("/api/crm/leads", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "update", id, updates: { contrato_id: contrato.id } }),
                    });
                    setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, contrato_id: contrato.id } : l)));
                }

                // clientes_receita, recebimentos, onboarding são criados na aprovação
                // (handleAprovar em /api/aprovacoes) para evitar duplicatas e registros órfãos

                toast.success("Contrato criado e enviado para aprovação!");
                globalMutate((key) => Array.isArray(key) && key[0] === 'dashboard-db');
            } catch (err: any) {
                toast.error("Etapa salva, mas falha ao criar registros auxiliares. Verifique Contratos/Entradas manualmente.");
                console.error("Erro ao processar compra:", err);
            }
        }
    }, [allLeads, closers, mutate]);

    const addNovoLead = useCallback(async (etapa: string, mesRef: string, extra?: { nome?: string; telefone?: string; email?: string; ghl_contact_id?: string; lead_avulso?: boolean; fonte_avulso?: string; origem_tipo?: string; ad_id_vinculado?: string; atribuicao_tier?: number }) => {
        const insertPayload: Record<string, unknown> = {
            nome: extra?.nome || "",
            etapa: etapa || "oportunidade",
            mes_referencia: mesRef,
            ghl_contact_id: extra?.ghl_contact_id || `manual-${Date.now()}`,
            telefone: extra?.telefone || null,
            email: extra?.email || null,
            lead_avulso: extra?.lead_avulso || false,
            fonte_avulso: extra?.fonte_avulso || null,
        };
        if (extra?.ad_id_vinculado) insertPayload.ad_id = extra.ad_id_vinculado;

        const res = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "insert", payload: insertPayload }),
        });
        const json = await res.json();

        if (!json.ok) { toast.error("Erro ao criar lead: " + (json.error || "erro desconhecido")); return null; }
        const dataRow = json.data;

        if (dataRow) {
            const newLead = dataRow as LeadCrm;
            setAllLeads((prev) => [newLead, ...prev]);
            setTotalCount((prev) => prev + 1);
            return newLead;
        }
        return null;
    }, []);

    const deleteLead = useCallback(async (id: string) => {
        if (!confirm("Excluir este lead permanentemente?")) return;
        const lead = allLeads.find((l) => l.id === id);
        const prev = allLeads;
        const prevCount = totalCount;
        setAllLeads((curr) => curr.filter((l) => l.id !== id));
        setTotalCount((c) => Math.max(0, c - 1));

        // Desvincular contrato ANTES de deletar (foreign key circular impede delete direto)
        if (lead) {
            // 1. Remover contrato_id do lead (quebra FK leads_crm → contratos)
            if (lead.contrato_id) {
                await fetch("/api/crm/leads", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "update", id, updates: { contrato_id: null } }),
                }).catch(() => {});
            }
            // 2. Deletar contratos vinculados por lead_id (quebra FK contratos → leads_crm)
            await supabase.from("contratos")
                .delete()
                .eq("lead_id", id);
            // 3. Deletar contrato pelo contrato_id (caso lead_id não esteja preenchido no contrato)
            if (lead.contrato_id) {
                await supabase.from("contratos")
                    .delete()
                    .eq("id", lead.contrato_id);
            }
        }

        const delRes = await fetch("/api/crm/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "delete", id }),
        });
        const delJson = await delRes.json();
        if (!delJson.ok) {
            setAllLeads(prev);
            setTotalCount(prevCount);
            toast.error("Erro ao excluir lead: " + (delJson.error || "erro desconhecido"));
            return;
        }

        toast.success("Lead excluido");
    }, [allLeads, totalCount]);

    return { leads: allLeads, closers, sdrs, contratosMap, loading, error: crmError || (swrError ? String(swrError) : null), mutate, updateLead, mudarEtapa, addNovoLead, deleteLead, loadMore, hasMore, totalCount, loadingMore };
}
