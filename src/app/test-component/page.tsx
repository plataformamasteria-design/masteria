'use client';

import { AttendanceTrendChart } from '@/components/analytics/attendance-trend-chart';
import { Providers } from '@/components/providers';

export default function TestPage() {
    return (
        <Providers>
            <div className="p-10">
                <h1>Teste de Componente: AttendanceTrendChart</h1>
                <p>Se você vê o gráfico (ou esqueleto) abaixo, o ChunkLoadError foi corrigido.</p>
                <div className="border p-4 mt-4">
                    <AttendanceTrendChart />
                </div>
            </div>
        </Providers>
    );
}
