import { PageHeader } from '@/components/page-header';
import { RoutingTable } from '@/components/routing/routing-table';

export default function RoutingPage() {
  return (
    <div className="space-y-6 flex items-center justify-center h-[50vh]">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Recurso Desativado</h2>
        <p className="text-muted-foreground">
          O roteamento de Inteligência Artificial foi desativado temporariamente por questões de segurança e manutenção.
        </p>
      </div>
    </div>
  );
}
