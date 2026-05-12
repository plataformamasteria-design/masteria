import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface UnauthorizedPageProps {
  pageName: string;
}

const PAGE_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  pipeline: "Pipeline",
  followup: "Follow Up",
  developer: "Developer",
  users: "Usuários",
};

export default function UnauthorizedPage({ pageName }: UnauthorizedPageProps) {
  const navigate = useNavigate();
  const displayName = PAGE_NAMES[pageName] || pageName;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
          <CardDescription className="text-base">
            Você não tem permissão para acessar a página <strong>{displayName}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Entre em contato com o administrador do sistema para solicitar acesso a esta área.
          </p>
          <Button 
            onClick={() => navigate("/dashboard")} 
            className="w-full"
          >
            Voltar ao Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
