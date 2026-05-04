import { PageHeader } from '@/components/page-header';
import { RoutingTable } from '@/components/routing/routing-table';

export default function RoutingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Roteamento de Atendimentos"
        description="Defina qual persona de IA ou equipe será responsável por cada conexão."
      />
      <RoutingTable />
    </div>
  );
}
