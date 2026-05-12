import AppShell from "@/components/AppShell";
import ModulesAndBillingTab from "@/components/settings/ModulesAndBillingTab";
import TokenBalanceSection from "@/components/settings/TokenBalanceSection";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOrganization } from "@/contexts/OrganizationContext";

const MeuPlano = () => {
  const { t } = useTranslation();
  const { currentOrganization } = useOrganization();

  const isLifetime = !!(currentOrganization as any)?.lifetime;

  const tokenSection = currentOrganization?.id ? (
    <TokenBalanceSection organizationId={currentOrganization.id} isLifetime={isLifetime} />
  ) : null;

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{t('myPlan.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('myPlan.subtitle')}</p>
            </div>
          </div>
          <ModulesAndBillingTab tokenSection={tokenSection} />
        </div>
      </div>
    </AppShell>
  );
};

export default MeuPlano;