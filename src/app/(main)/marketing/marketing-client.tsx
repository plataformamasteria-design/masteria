'use client';

/**
 * MarketingClient — Renderiza diretamente o gerenciador de tráfego.
 * Os providers (AdAccount, PeriodoTrafego) e a navegação agora vivem
 * no layout.tsx, então este componente é apenas um pass-through.
 */
import TrafegoGerenciarPage from "./gerenciar/_gerenciar-content";

interface MarketingClientProps {
  companyId: string;
}

export default function MarketingClient({ companyId }: MarketingClientProps) {
  return <TrafegoGerenciarPage />;
}
