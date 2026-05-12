import { useState } from "react";
import AppShell from "@/components/AppShell";
import PagePermissionGuard from "@/components/PagePermissionGuard";
import { FinancialSummary } from "@/components/financeiro/FinancialSummary";
import { RevenueChart } from "@/components/financeiro/RevenueChart";
import { MonthlyRevenueChart } from "@/components/financeiro/MonthlyRevenueChart";
import { FixedCostsPanel } from "@/components/financeiro/FixedCostsPanel";
import { TransactionList } from "@/components/financeiro/TransactionList";
import { TopClients } from "@/components/financeiro/TopClients";
import { ProductBreakdown } from "@/components/financeiro/ProductBreakdown";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { startOfMonth, endOfMonth } from "date-fns";
import { DateRange } from "react-day-picker";
import { PlanDisabledGuard } from "@/components/PlanDisabledGuard";
import { DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Financeiro() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });

  return (
    <PlanDisabledGuard>
      <PagePermissionGuard page="financeiro">
        <AppShell>
          <div className="space-y-4 md:space-y-6 pb-12">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0"><DollarSign className="h-5 w-5 md:h-6 md:w-6 text-primary" /></div>
                <div className="min-w-0">
                  <h1 className="text-xl md:text-3xl font-bold tracking-tight">{t('financial.title')}</h1>
                  <p className="text-muted-foreground text-xs md:text-sm">{t('financial.subtitle')}</p>
                </div>
              </div>
              <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
            </div>
            <FinancialSummary dateRange={dateRange} />
            <FixedCostsPanel />
            <div className="grid gap-4 md:gap-6 grid-cols-1 xl:grid-cols-2">
              <RevenueChart dateRange={dateRange} />
              <MonthlyRevenueChart dateRange={dateRange} />
            </div>
            <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
              <div className="lg:col-span-2"><ProductBreakdown dateRange={dateRange} /></div>
              <TopClients dateRange={dateRange} />
            </div>
            <TransactionList dateRange={dateRange} />
          </div>
        </AppShell>
      </PagePermissionGuard>
    </PlanDisabledGuard>
  );
}