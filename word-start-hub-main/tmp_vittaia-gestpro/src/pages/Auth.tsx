import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import vittaIcon from "@/assets/vitta-icon.png";
import { z } from "zod";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationKey, setOrganizationKey] = useState("");
  const [orgKeyValid, setOrgKeyValid] = useState<boolean | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [isMagicLink, setIsMagicLink] = useState(false);
  const navigate = useNavigate();

  const PUBLISHED_BASE_URL = "https://chat-manager-desk.lovable.app";

  // Check for invite link params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteSlug = params.get('invite');
    if (inviteSlug) {
      setIsLogin(false);
      setOrganizationKey(inviteSlug);
      setIsMagicLink(true);
    }
  }, []);

  useEffect(() => {

    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handleUserRedirect(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && event === 'SIGNED_IN') {
        // Usar setTimeout para evitar deadlock
        setTimeout(async () => {
          await handleUserRedirect(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateOrgKey = async (key: string) => {
    const trimmedKey = key.trim().toLowerCase();

    if (!trimmedKey) {
      setOrgKeyValid(null);
      return;
    }

    setValidatingKey(true);
    try {
      // Usar função RPC para validar slug (bypass RLS)
      const { data, error } = await supabase.rpc('validate_organization_slug', {
        slug_to_check: trimmedKey
      });

      if (error) throw error;
      setOrgKeyValid(data === true);
    } catch (error) {
      console.error('Erro ao validar chave:', error);
      setOrgKeyValid(false);
    } finally {
      setValidatingKey(false);
    }
  };

  // Debounce da validação
  useEffect(() => {
    if (!isLogin && organizationKey) {
      const timer = setTimeout(() => {
        validateOrgKey(organizationKey);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setOrgKeyValid(null);
    }
  }, [organizationKey, isLogin]);

  const handleUserRedirect = async (userId: string) => {
    try {
      // Verificar perfil e aprovação
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('approved, pending_approval, organization_id')
        .eq('id', userId)
        .maybeSingle();

      // Se perfil não aprovado e pendente, vai para pending
      if (profile && profile.pending_approval === true && profile.approved === false) {
        navigate("/pending-authorization");
        return;
      }

      // Verificar se é super admin primeiro
      const { data: roleData } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'super_admin')
        .maybeSingle();

      if (roleData) {
        navigate("/organizations");
        return;
      }

      // Check if user belongs to multiple organizations
      const { data: userOrgs } = await (supabase as any)
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', userId);

      if (userOrgs && userOrgs.length > 1) {
        navigate("/select-organization");
        return;
      }

      // Verificar se é admin
      const { data: adminRoleData } = await (supabase as any)
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (adminRoleData) {
        navigate("/dashboard");
        return;
      }

      // Verificar permissões de página
      const { data: permissions } = await (supabase as any)
        .from('user_page_permissions')
        .select('page')
        .eq('user_id', userId);

      if (permissions && permissions.length > 0) {
        navigate("/dashboard");
      } else {
        navigate("/pending-authorization");
      }
    } catch (error) {
      console.error('Error checking user permissions:', error);
      navigate("/pending-authorization");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive"
          });
          return;
        }

        if (data.user) {
          // Process invite locally if they entered a magic link string
          if (organizationKey) {
            const { error: inviteError } = await supabase.rpc('accept_organization_invite', { org_slug: organizationKey.trim().toLowerCase() });
            if (inviteError) console.error("Error accepting invite via login:", inviteError);
          }
          // Redirect é tratado pelo onAuthStateChange
        }
      } else {
        // Validar chave da organização (skip for magic link)
        if (!isMagicLink) {
          if (!organizationKey.trim()) {
            toast({
              title: "Chave do Painel obrigatória",
              description: "Informe a chave do painel fornecida pelo administrador",
              variant: "destructive"
            });
            return;
          }

          if (orgKeyValid === false) {
            toast({
              title: "Chave inválida",
              description: "A chave do painel informada não existe",
              variant: "destructive"
            });
            return;
          }
        }

        // Signup com aprovação pendente
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName.trim(),
              requested_org_slug: organizationKey.trim().toLowerCase(),
              ...(isMagicLink ? { magic_link: true } : {})
            }
          }
        });

        if (signUpError) {
          // Handle rate limit errors
          if (signUpError.status === 429 || signUpError.message?.includes('rate limit') || signUpError.message?.includes('For security purposes')) {
            toast({
              title: "Aguarde um momento",
              description: "Por segurança, aguarde alguns segundos antes de tentar novamente.",
              variant: "destructive"
            });
          } else if (signUpError.message?.includes('already registered') || signUpError.message?.includes('User already registered')) {
            // SILENT SIGN-IN FALLBACK FOR EXISTING USERS TYPING THEIR PASSWORD
            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

            if (loginData?.user && !loginError) {
              // Senha bateu com a do usuário antigo! Linka e loga!
              if (organizationKey) {
                await supabase.rpc('accept_organization_invite', { org_slug: organizationKey.trim().toLowerCase() });
              }
              toast({
                title: "Conta conectada com sucesso!",
                description: "Nós identificamos sua conta existente e a vinculamos automaticamente."
              });
              return; // onAuthStateChange takes care of redirecting
            }

            toast({
              title: "Email já cadastrado",
              description: "Você já possui conta. Por favor, vá para a tela de Login e digite sua senha para entrar.",
              variant: "destructive"
            });
            setIsLogin(true);
          } else {
            toast({
              title: "Erro ao criar conta",
              description: signUpError.message,
              variant: "destructive"
            });
          }
          return;
        }

        // Detect repeated signup (Supabase returns 200 with empty identities when prevent_email_enumeration is on)
        if (authData.user && (!authData.user.identities || authData.user.identities.length === 0)) {
          // SILENT SIGN-IN FALLBACK
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

          if (loginData?.user && !loginError) {
            if (organizationKey) {
              await supabase.rpc('accept_organization_invite', { org_slug: organizationKey.trim().toLowerCase() });
            }
            toast({
              title: "Conta conectada com sucesso!",
              description: "Nós identificamos sua conta existente e a vinculamos automaticamente."
            });
            return;
          }

          toast({
            title: "Email já cadastrado",
            description: "Você já possui conta. Por favor, vá para a tela de Login e digite sua senha para entrar.",
            variant: "destructive"
          });
          setIsLogin(true);
          return;
        }

        // Check if email confirmation is needed (user exists but no session)
        if (authData.user && !authData.session) {
          toast({
            title: "Conta criada com sucesso!",
            description: "Verifique seu email para confirmar o cadastro antes de fazer login.",
          });
          setIsLogin(true);
          return;
        }

        // User has session - will be redirected by onAuthStateChange
      }
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    const schema = z
      .string()
      .trim()
      .min(1, "Informe o email")
      .email("Email inválido")
      .max(255, "Email muito longo");

    const parsed = schema.safeParse(email);
    if (!parsed.success) {
      toast({
        title: "Email inválido",
        description: parsed.error.issues[0]?.message ?? "Verifique o email informado",
        variant: "destructive",
      });
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${PUBLISHED_BASE_URL}/reset-password`,
      });

      if (error) {
        toast({
          title: "Erro ao enviar link",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Link enviado",
        description: "Se esse email existir, você receberá um link para redefinir sua senha.",
      });
      setShowForgotPassword(false);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível enviar o link agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background selection:bg-primary/20">
      {/* ElevenLabs Style Subtle Mesh Background */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-accent/5 rounded-full blur-[140px]" />
      </div>

      <div className="w-full max-w-[420px] z-10 animate-slide-up" style={{ animationDuration: '600ms', animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-1 mb-8">
            <img src={vittaIcon} alt="Vitta" className="h-10 w-auto opacity-90 hover:opacity-100 transition-opacity drop-shadow-sm" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3 font-heading">
            {isLogin ? "Bem-vindo de volta" : "Comece sua jornada"}
          </h1>
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            {isLogin ? "Acesse sua conta para continuar" : "Crie uma conta em segundos"}
          </p>
        </div>

        <Card className="border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="space-y-5 animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nome Completo</label>
                    <Input
                      type="text"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                      className="h-11 bg-background/30 border-border/50 focus:border-primary/40 focus:ring-0 transition-all rounded-lg placeholder:text-muted-foreground/40"
                    />
                  </div>
                  {!isMagicLink && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Chave do Painel</label>
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="chave-vitta-2024"
                          value={organizationKey}
                          onChange={e => setOrganizationKey(e.target.value)}
                          required
                          className={cn(
                            "h-11 bg-background/30 border-border/50 transition-all pr-10 rounded-lg placeholder:text-muted-foreground/40",
                            orgKeyValid === true && "border-green-500/30",
                            orgKeyValid === false && "border-destructive/30"
                          )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {validatingKey && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />}
                          {!validatingKey && orgKeyValid === true && <CheckCircle2 className="h-4 w-4 text-green-500 opacity-70" />}
                          {!validatingKey && orgKeyValid === false && <XCircle className="h-4 w-4 text-destructive opacity-70" />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isLogin && showForgotPassword ? (
                <div className="space-y-6 animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 bg-background/30 border-border/50 transition-all rounded-lg placeholder:text-muted-foreground/40"
                    />
                  </div>

                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Enviaremos um link de recuperação para o email informado. Por favor, verifique sua caixa de entrada.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    <Button
                      type="button"
                      className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-all"
                      onClick={handleSendResetLink}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? "Enviando..." : "Enviar link de recuperação"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-11 text-muted-foreground hover:text-foreground text-sm font-medium"
                      onClick={() => setShowForgotPassword(false)}
                      disabled={forgotLoading}
                    >
                      Voltar para o login
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    <div className="space-y-2 animate-slide-up" style={{ animationDelay: '50ms' }}>
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Profissional</label>
                      <Input
                        type="email"
                        placeholder="nome@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 bg-background/30 border-border/50 focus:border-primary/40 focus:ring-0 transition-all rounded-lg placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <div className="space-y-2 animate-slide-up" style={{ animationDelay: '100ms' }}>
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Senha</label>
                        {isLogin && (
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(true)}
                            className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary-hover transition-colors"
                          >
                            Esqueci a senha
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-11 bg-background/30 border-border/50 focus:border-primary/40 focus:ring-0 transition-all pr-12 rounded-lg placeholder:text-muted-foreground/40"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 space-y-4">
                    <Button
                      type="submit"
                      className="w-full h-11 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg shadow-sm hover:shadow-primary/20 transition-all active:scale-[0.98] animate-slide-up"
                      style={{ animationDelay: '150ms' }}
                      disabled={loading || (!isLogin && !isMagicLink && orgKeyValid === false)}
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Autenticando...
                        </span>
                      ) : isLogin ? "Acessar Plataforma" : "Criar Conta Pro"}
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setOrganizationKey("");
                        setOrgKeyValid(null);
                        setShowForgotPassword(false);
                      }}
                      className="w-full pb-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors animate-slide-up underline underline-offset-4 decoration-border"
                      style={{ animationDelay: '200ms' }}
                    >
                      {isLogin ? "Não possui conta? Registre-se agora" : "Já é membro? Faça login aqui"}
                    </button>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <footer className="mt-12 text-center animate-slide-up" style={{ animationDelay: '400ms' }}>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Vitta Intelligence System
          </p>
        </footer>
      </div>
    </div>
  );
}
