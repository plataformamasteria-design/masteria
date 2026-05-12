import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PlanDisabledGuard({ children }: { children: React.ReactNode }) {
  const { isPlanDisabled, isOverUserLimit, currentUserCount, currentOrganization, isSuperAdmin } = useOrganization();
  const navigate = useNavigate();

  // Super admins bypass all checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Lifetime orgs bypass all restrictions (unlimited users and full access)
  if ((currentOrganization as any)?.lifetime) {
    return <>{children}</>;
  }

  // Over user limit takes priority
  if (isOverUserLimit) {
    const maxUsers = currentOrganization?.max_users || 3;
    const { isAdmin, isSubAdmin } = require('@/hooks/usePagePermissions').usePagePermissions();
    const canManageOrBypass = isSuperAdmin || isAdmin || isSubAdmin;

    // For managers: Don't lock them out. Show a persistent top banner instead.
    if (canManageOrBypass) {
      return (
        <div className="flex flex-col min-h-screen w-full">
          <div className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-3 text-center flex-shrink-0 flex max-sm:flex-col items-center justify-center gap-4 z-50">
            <div className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              <span>Limite de {maxUsers} usuários excedido (atualmente {currentUserCount}).</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => navigate('/meu-plano')} className="h-8 text-xs px-3">
                Atualizar Plano
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/profile?tab=usuarios')} className="h-8 text-xs px-3 border-destructive/30 hover:bg-destructive/10 text-destructive">
                Remover Usários
              </Button>
            </div>
          </div>
          <div className="flex-1 relative">
            {children}
          </div>
        </div>
      );
    }

    // For regular members: Fatal lock screen
    return (
      <div className="relative min-h-screen w-full">
        <div className="blur-md pointer-events-none select-none">
          {children}
        </div>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <Card className="max-w-md w-full shadow-2xl border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-2">
                <Users className="h-6 w-6" />
                <CardTitle>Limite de Capacidade Atingido</CardTitle>
              </div>
              <CardDescription>
                A plataforma está operando acima do balanço do plano. Notifique o administrador para gerenciar o pacote.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (isPlanDisabled) {
    return (
      <div className="relative min-h-screen w-full">
        <div className="blur-md pointer-events-none select-none">
          {children}
        </div>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="max-w-md w-full shadow-2xl border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="h-6 w-6" />
                <CardTitle>Plano Desativado</CardTitle>
              </div>
              <CardDescription>
                O plano da organização <strong>{currentOrganization?.name}</strong> está atualmente desativado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Entre em contato com o administrador da plataforma para reativar o acesso.
              </p>
              <Button
                onClick={() => navigate('/profile')}
                variant="outline"
                className="w-full gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Ir para Perfil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
