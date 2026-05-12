import { useOrganizationModules } from './useOrganizationModules';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * Hook for checking module-level feature access within pages.
 * Use this for conditional rendering of features that depend on active modules.
 * 
 * Module mapping:
 * - padrao: Base features (dashboard, chat, agenda basic, commands, leads basic, pipeline, crm, financeiro, teams)
 * - automacao_simples: Flow automations, broadcast (disparos), agenda link/widget
 * - atendente_ia: AI automation, developer portal
 */
export function useModuleAccess() {
  const { currentOrganization } = useOrganization();
  const { modules, isLoading } = useOrganizationModules(currentOrganization?.id);
  const isLifetime = !!(currentOrganization as any)?.lifetime;

  const hasModule = (key: string): boolean => {
    if (isLifetime) return true;
    return modules.some(m => m.module_key === key && m.active);
  };

  // Specific feature checks
  const canUseFlowAutomation = hasModule('automacao_simples') || hasModule('atendente_ia');
  const canUseBroadcast = hasModule('automacao_simples') || hasModule('atendente_ia');
  const canUseAgendaLink = hasModule('automacao_simples') || hasModule('atendente_ia');
  const canUseAgendaWidget = hasModule('automacao_simples') || hasModule('atendente_ia');
  const canUseBotActivation = hasModule('atendente_ia');
  const canUseAIAutomation = hasModule('atendente_ia');
  const canUseDeveloper = hasModule('atendente_ia');

  return {
    isLoading,
    hasModule,
    canUseFlowAutomation,
    canUseBroadcast,
    canUseAgendaLink,
    canUseAgendaWidget,
    canUseBotActivation,
    canUseAIAutomation,
    canUseDeveloper,
  };
}
