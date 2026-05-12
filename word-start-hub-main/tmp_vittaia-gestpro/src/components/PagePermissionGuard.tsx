import { ReactNode } from "react";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import UnauthorizedPage from "./UnauthorizedPage";
import { Skeleton } from "@/components/ui/skeleton";

type AppPage = 'dashboard' | 'leads' | 'pipeline' | 'followup' | 'chat' | 'users' | 'developer' | 'promptia' | 'agenda' | 'teams' | 'financeiro' | 'organizations' | 'commands' | 'automations' | 'disparos' | 'diagnostico' | 'marketing';

interface PagePermissionGuardProps {
  page: AppPage;
  children: ReactNode;
}

export default function PagePermissionGuard({ page, children }: PagePermissionGuardProps) {
  const { hasPermission, isLoading } = usePagePermissions();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasPermission(page)) {
    return <UnauthorizedPage pageName={page} />;
  }

  return <>{children}</>;
}
