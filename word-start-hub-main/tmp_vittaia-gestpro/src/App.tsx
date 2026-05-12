import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useProjectInitializer } from "./hooks/useProjectInitializer";
import { PlanDisabledGuard } from "./components/PlanDisabledGuard";
import { ModuleLockedGuard } from "./components/ModuleLockedGuard";
import { ThemeInitializer } from "./components/ThemeInitializer";
import { usePagePermissions } from "./hooks/usePagePermissions";
import { OrganizationProvider } from "./contexts/OrganizationContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalErrorHandler } from "./components/GlobalErrorHandler";
import PagePermissionGuard from "./components/PagePermissionGuard";

// Eagerly loaded (lightweight / critical path)
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy loaded pages
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const CRM = lazy(() => import("./pages/CRM"));
const DiagnosticoLeads = lazy(() => import("./pages/DiagnosticoLeads"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Leads = lazy(() => import("./pages/Leads"));
const Chat = lazy(() => import("./pages/Chat"));
const Developer = lazy(() => import("./pages/Developer"));
const Teams = lazy(() => import("./pages/Teams"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Profile = lazy(() => import("./pages/Profile"));
const MeuPlano = lazy(() => import("./pages/MeuPlano"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Commands = lazy(() => import("./pages/Commands"));
const Automations = lazy(() => import("./pages/Automations"));
const AutomationFlowEditorPage = lazy(() => import("./pages/AutomationFlowEditor"));
const Disparos = lazy(() => import("./pages/Disparos"));
const WaOfficialCampaigns = lazy(() => import("./pages/WaOfficialCampaigns"));
const GoogleBusiness = lazy(() => import("./pages/GoogleBusiness"));
const EmailPage = lazy(() => import("./pages/Email"));
const PendingAuthorization = lazy(() => import("./pages/PendingAuthorization"));
const GoogleAuthCallback = lazy(() => import("./pages/GoogleAuthCallback"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const Trial = lazy(() => import("./pages/Trial"));
const SelectOrganization = lazy(() => import("./pages/SelectOrganization"));
const GhlSso = lazy(() => import("./pages/GhlSso"));

const LazyFallback = () => (
  <div className="min-h-screen bg-background text-foreground grid place-items-center">
    <div className="text-sm text-muted-foreground">Carregando…</div>
  </div>
);

function SuspenseWrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>;
}

import { PhoneWidget } from "./components/phone/PhoneWidget";
import { WhatsAppConnectionBanner } from "./components/layout/WhatsAppConnectionBanner";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const navigate = useNavigate();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsAuthReady(true);
        queryClient.clear();
        localStorage.removeItem('user_permissions_cache');
        localStorage.removeItem('user_permissions_cache_time');
        hasRedirectedRef.current = true;
        navigate('/auth');
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        setIsAuthenticated(!!session);
        setIsAuthReady(true);
        if (session) {
          hasRedirectedRef.current = false;
        }
      }
    });

    // Bootstrap local session check
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        setIsAuthenticated(!!data.session);
        setIsAuthReady(true);
      } catch {
        if (!mounted) return;
        setIsAuthenticated(false);
        setIsAuthReady(true);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!isAuthReady) return;

    if (!isAuthenticated && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      navigate('/auth');
    }
  }, [isAuthenticated, isAuthReady, navigate]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center">
        <div className="text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

const AuthorizedRoute = ({ children }: { children: React.ReactNode }) => {
  const { hasPendingAuthorization, isLoading, isAdmin } = usePagePermissions();
  const navigate = useNavigate();
  const location = window.location;

  useEffect(() => {
    if (!isLoading) {
      const pending = hasPendingAuthorization();

      // Redirecionar para pending APENAS se o usuário não tem NENHUMA permissão
      // e não está já na página de pending-authorization
      if (pending && location.pathname !== "/pending-authorization" && location.pathname !== "/auth") {
        navigate("/pending-authorization");
      }
      // Se usuário tem permissões ou é admin e está na página de pending, redirecionar para dashboard
      else if (!pending && location.pathname === "/pending-authorization") {
        navigate("/dashboard");
      }
    }
  }, [hasPendingAuthorization, isLoading, isAdmin, navigate, location.pathname]);

  return <>{children}</>;
};

const ProjectInitializer = ({ children }: { children: React.ReactNode }) => {
  useProjectInitializer();
  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <GlobalErrorHandler />
      <ThemeInitializer />
      <ProjectInitializer>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <OrganizationProvider>
              <WhatsAppConnectionBanner />
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<SuspenseWrap><ResetPassword /></SuspenseWrap>} />
                <Route path="/privacy" element={<SuspenseWrap><Privacy /></SuspenseWrap>} />
                <Route path="/terms" element={<SuspenseWrap><Terms /></SuspenseWrap>} />
                <Route path="/agendar/:slug" element={<SuspenseWrap><PublicBooking /></SuspenseWrap>} />
                <Route path="/a/:slug" element={<SuspenseWrap><PublicBooking /></SuspenseWrap>} />
                <Route path="/trial" element={<SuspenseWrap><Trial /></SuspenseWrap>} />
                <Route path="/ghl-sso" element={<SuspenseWrap><GhlSso /></SuspenseWrap>} />
                <Route path="/select-organization" element={<ProtectedRoute><SuspenseWrap><SelectOrganization /></SuspenseWrap></ProtectedRoute>} />
                <Route
                  path="/pending-authorization"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <SuspenseWrap><PendingAuthorization /></SuspenseWrap>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="dashboard">
                            <SuspenseWrap><Dashboard /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pipeline"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="pipeline">
                            <SuspenseWrap><Pipeline /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/crm"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="pipeline">
                            <SuspenseWrap><CRM /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/diagnostico-leads"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="diagnostico">
                            <SuspenseWrap><DiagnosticoLeads /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/marketing"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="marketing">
                            <SuspenseWrap><Marketing /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="leads">
                            <SuspenseWrap><Leads /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="chat">
                            <SuspenseWrap><Chat /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="/follow-up" element={<Navigate to="/automations" replace />} />
                <Route path="/robot" element={<Navigate to="/leads" replace />} />
                <Route
                  path="/developer"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <ModuleLockedGuard page="developer">
                            <SuspenseWrap><Developer /></SuspenseWrap>
                          </ModuleLockedGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="/users" element={<Navigate to="/profile?tab=usuarios" replace />} />
                <Route
                  path="/teams"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="teams">
                            <SuspenseWrap><Teams /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route path="/promptia" element={<Navigate to="/automations?tab=ia" replace />} />
                <Route
                  path="/agenda"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="agenda">
                            <SuspenseWrap><Agenda /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/financeiro"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="financeiro">
                            <SuspenseWrap><Financeiro /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organizations"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <SuspenseWrap><Organizations /></SuspenseWrap>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/commands"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <PagePermissionGuard page="commands">
                            <SuspenseWrap><Commands /></SuspenseWrap>
                          </PagePermissionGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/automations"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <SuspenseWrap><Automations /></SuspenseWrap>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/automations/:id"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <ModuleLockedGuard page="automations">
                            <SuspenseWrap><AutomationFlowEditorPage /></SuspenseWrap>
                          </ModuleLockedGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/disparos"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <ModuleLockedGuard page="disparos">
                            <SuspenseWrap><Disparos /></SuspenseWrap>
                          </ModuleLockedGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/whatsapp-oficial"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <ModuleLockedGuard page="disparos">
                            <SuspenseWrap><WaOfficialCampaigns /></SuspenseWrap>
                          </ModuleLockedGuard>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/google-business"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <SuspenseWrap><GoogleBusiness /></SuspenseWrap>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email"
                  element={
                    <ProtectedRoute>
                      <AuthorizedRoute>
                        <PlanDisabledGuard>
                          <SuspenseWrap><EmailPage /></SuspenseWrap>
                        </PlanDisabledGuard>
                      </AuthorizedRoute>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/google-auth-callback"
                  element={
                    <ProtectedRoute>
                      <SuspenseWrap><GoogleAuthCallback /></SuspenseWrap>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/meu-plano"
                  element={
                    <ProtectedRoute>
                      <SuspenseWrap><MeuPlano /></SuspenseWrap>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <SuspenseWrap><Profile /></SuspenseWrap>
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<LandingPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <PhoneWidget />
            </OrganizationProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ProjectInitializer>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;