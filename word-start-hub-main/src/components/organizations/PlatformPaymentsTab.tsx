import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard, Settings2, History, Receipt, Zap
} from "lucide-react";
import { GlobalModulesConfig } from "./GlobalModulesConfig";
import { MercadoPagoConfigSection } from "./billing/MercadoPagoConfigSection";
import { InvoicesSection } from "./billing/InvoicesSection";
import { PaymentHistorySection } from "./billing/PaymentHistorySection";
import { TokenManagementSection } from "./billing/TokenManagementSection";

export function PlatformPaymentsTab() {
  return (
    <Tabs defaultValue="config" className="w-full">
      <TabsList className="grid w-full grid-cols-5 max-w-2xl mb-4">
        <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Preços</span>
          <span className="sm:hidden">Preços</span>
        </TabsTrigger>
        <TabsTrigger value="tokens" className="gap-1.5 text-xs sm:text-sm">
          <Zap className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tokens</span>
          <span className="sm:hidden">Tokens</span>
        </TabsTrigger>
        <TabsTrigger value="mercadopago" className="gap-1.5 text-xs sm:text-sm">
          <CreditCard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mercado Pago</span>
          <span className="sm:hidden">MP</span>
        </TabsTrigger>
        <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
          <Receipt className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Faturas</span>
          <span className="sm:hidden">Faturas</span>
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Histórico</span>
          <span className="sm:hidden">Hist.</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="config">
        <GlobalModulesConfig />
      </TabsContent>

      <TabsContent value="tokens">
        <TokenManagementSection />
      </TabsContent>

      <TabsContent value="mercadopago">
        <MercadoPagoConfigSection />
      </TabsContent>

      <TabsContent value="invoices">
        <InvoicesSection />
      </TabsContent>

      <TabsContent value="history">
        <PaymentHistorySection />
      </TabsContent>
    </Tabs>
  );
}
