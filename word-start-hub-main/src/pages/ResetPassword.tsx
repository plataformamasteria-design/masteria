import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(72, "Senha muito longa"),
          confirmPassword: z.string(),
        })
        .refine((v) => v.password === v.confirmPassword, {
          message: "As senhas não coincidem",
          path: ["confirmPassword"],
        }),
    []
  );

  useEffect(() => {
    const init = async () => {
      setLoadingSession(true);
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // Se vier com code (PKCE), troca por session
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data } = await supabase.auth.getSession();
        setHasSession(!!data.session);
      } catch {
        setHasSession(false);
      } finally {
        setLoadingSession(false);
      }
    };

    init();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Verifique os campos";
      toast({ title: "Dados inválidos", description: msg, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast({ title: "Erro ao redefinir senha", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Senha redefinida", description: "Agora você pode entrar normalmente na plataforma." });
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível redefinir sua senha agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle>Link inválido ou expirado</CardTitle>
            <CardDescription>
              Solicite novamente em “Esqueci minha senha” na tela de login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
              Voltar para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Salvando..." : "Redefinir senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
