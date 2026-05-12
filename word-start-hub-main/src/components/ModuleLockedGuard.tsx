import { useOrganization } from '@/contexts/OrganizationContext';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { MODULE_DEFINITIONS } from '@/hooks/useOrganizationModules';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

/**
 * Maps page routes to the module that unlocks them.
 */
const PAGE_TO_MODULE: Record<string, string> = {
  disparos: 'automacao_simples',
  developer: 'atendente_ia',
  promptia: 'atendente_ia',
};

interface ModuleLockedGuardProps {
  page: string;
  children: React.ReactNode;
}

export function ModuleLockedGuard({ page, children }: ModuleLockedGuardProps) {
  const { isSuperAdmin } = useOrganization();
  const { hasModule, isLoading } = useModuleAccess();
  const navigate = useNavigate();

  // Super admin bypasses
  if (isSuperAdmin) return <>{children}</>;

  // While loading, show children (will be fast)
  if (isLoading) return <>{children}</>;

  const requiredModule = PAGE_TO_MODULE[page];
  
  // No module restriction for this page
  if (!requiredModule) return <>{children}</>;

  // Check if org has the required module
  if (hasModule(requiredModule)) return <>{children}</>;

  const moduleDef = MODULE_DEFINITIONS[requiredModule];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Back button */}
      <div className="absolute top-3 left-3 z-50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Blurred content */}
      <div className="blur-md pointer-events-none select-none opacity-30 h-full">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl border-border/50 bg-card/95 backdrop-blur-xl">
          <CardHeader className="text-center pb-2 pt-5">
            <div className="mx-auto mb-2 h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Lock className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Módulo Bloqueado</CardTitle>
            <CardDescription className="text-sm">
              Esta funcionalidade requer o módulo{' '}
              <span className="font-semibold text-foreground">{moduleDef?.label || requiredModule}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-5">
            {moduleDef && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  O que este módulo inclui:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {moduleDef.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Entre em contato com o administrador da plataforma para contratar este módulo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
