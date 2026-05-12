import AIInsightsWidget from "@/components/dashboard/AIInsightsWidget";

export function InsightsInteligentesTab() {
    return (
        <div className="space-y-6 mt-4 animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h2 className="text-xl font-bold tracking-tight mb-1">Insights Inteligentes</h2>
                <p className="text-sm text-muted-foreground">Análises contínuas geradas pela I.A sobre suas campanhas e conjuntos de anúncios.</p>
            </div>

            <AIInsightsWidget className="w-full shadow-md rounded-2xl" />
        </div>
    );
}
