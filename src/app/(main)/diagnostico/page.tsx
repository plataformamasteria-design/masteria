import { Metadata } from 'next';
import { DiagnosticClientView } from '@/components/diagnostics/diagnostic-client-view';

export const metadata: Metadata = {
    title: 'Diagnóstico de Leads | MasterIA',
    description: 'Análise de métricas, LTV, CAC e visão de pipeline geral.',
};

export default function DiagnosticoPage() {
    return (
        <div className="flex-1 w-full flex flex-col min-h-screen relative p-4 lg:p-8 bg-zinc-50 dark:bg-zinc-950">
            <DiagnosticClientView />
        </div>
    );
}
