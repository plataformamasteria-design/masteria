'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import VersionBadge from '@/components/version-badge';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// Refactored Components
import { SocialButtons } from '@/components/auth/social-buttons';
import { LoginForm } from '@/components/auth/login-form';
import { useLoginFlow } from '@/hooks/use-login-flow';

const errorMessages: Record<string, { title: string; description: string }> = {
  token_expirado: {
    title: 'Sessão Expirada',
    description: 'Sua sessão expirou. Por favor, faça login novamente para continuar.',
  },
  token_invalido: {
    title: 'Sessão Inválida',
    description: 'Houve um problema com sua sessão. Por favor, faça login novamente.',
  },
  usuario_nao_encontrado: {
    title: 'Utilizador Não Encontrado',
    description: 'A sua conta não foi encontrada no banco de dados. O utilizador pode ter sido removido.',
  },
  token_nao_encontrado: {
    title: 'Sessão Não Encontrada',
    description: 'Você precisa fazer login para aceder a esta página.',
  },
  erro_banco_dados: {
    title: 'Erro de Servidor',
    description: 'Não foi possível conectar ao banco de dados para validar sua sessão. Tente novamente mais tarde.',
  },
  dados_usuario_ausentes: {
    title: 'Erro de Sessão',
    description: 'Os dados do utilizador não foram encontrados na sessão. Por favor, tente fazer login novamente.',
  },
};

function LoginError({ errorKey }: { errorKey: string | null }) {
  if (!errorKey || !errorMessages[errorKey]) {
    return null;
  }

  const errorDetails = errorMessages[errorKey];

  return (
    <Alert variant="destructive" className="mb-6 animate-in fade-in slide-in-from-top-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{errorDetails.title}</AlertTitle>
      <AlertDescription>{errorDetails.description}</AlertDescription>
    </Alert>
  );
}

function TypewriterEffect({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let index = 0;
    const intervalId = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index === text.length) {
        clearInterval(intervalId);
      }
    }, 50); // Speed of typing
    return () => clearInterval(intervalId);
  }, [text]);

  return <span>{displayedText}</span>;
}

function LoginPageContent() {
  const [isMounted, setIsMounted] = useState(false);
  const [viewState, setViewState] = useState<'greeting' | 'login'>('greeting');
  const { errorKey } = useLoginFlow();
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    // If there is an error (e.g. session expired), skip greeting and show login immediately
    if (errorKey) {
      setViewState('login');
    }
  }, [errorKey]);

  const handleRegisterClick = () => {
    router.push('/register');
  };

  return (
    <>
      <div className="w-full min-h-screen flex items-center justify-center overflow-hidden bg-background relative" suppressHydrationWarning>

        {/* Background Elements for "Premium" Feel - Centered */}
        <div className="absolute top-0 right-0 p-8 z-20">
          <ThemeToggle />
        </div>
        <div className="absolute top-4 left-4 z-20">
          <VersionBadge prefix="v" />
        </div>

        {/* Decorative Gradient Blob - Adjusted for centered layout */}
        <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />

        {/* Main Content Container with Glassmorphism */}
        <div className="w-full max-w-lg relative z-10 px-6">
          <AnimatePresence mode="wait">
            {viewState === 'greeting' ? (
              <motion.div
                key="greeting"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="bg-background/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 space-y-8 text-center"
              >
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative bg-background border border-primary/20 p-6 rounded-3xl shadow-2xl">
                      <Bot className="h-16 w-16 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <span className="flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl font-bold tracking-tight">
                    <span className="text-primary">Master IA</span>
                  </h2>
                  <div className="h-12 flex items-center justify-center text-xl text-muted-foreground font-medium leading-relaxed">
                    {isMounted && "Olá! Sou Amanda, Como posso ajudar você hoje?"}
                  </div>
                </div>

                <div className="grid gap-4 pt-8 max-w-sm mx-auto">
                  <Button
                    size="lg"
                    onClick={() => setViewState('login')}
                    className="group relative overflow-hidden h-14 text-base shadow-lg hover:shadow-primary/25 transition-all duration-300 w-full"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="flex items-center justify-center gap-2">
                      Fazer Login
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleRegisterClick}
                    className="h-14 text-base hover:bg-primary/5 transition-all duration-300 w-full"
                  >
                    <span className="flex items-center justify-center gap-2 text-muted-foreground hover:text-primary">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Cadastrar 3 dias grátis
                    </span>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground pt-4 opacity-40">
                  Secure Automation Platform powered by PLATAFORMAAI Autonomous
                </p>

                {/* Termos e Políticas - Vista de Boas-vindas */}
                <div className="mt-6 text-center text-sm text-gray-800 bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-primary/20 shadow-lg">
                  Ao entrar, você concorda com nossos{" "}
                  <Link href="/terms" className="underline text-primary hover:text-primary/80 transition-colors">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link href="/privacy" className="underline text-primary hover:text-primary/80 transition-colors">
                    Política de Privacidade
                  </Link>
                  .
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-background/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10"
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-xl mb-4">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight">Bem-vindo de volta!</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Acesse sua conta para continuar.
                  </p>
                </div>

                {isMounted && (
                  <Suspense fallback={null}>
                    <LoginError errorKey={errorKey} />
                  </Suspense>
                )}

                <LoginForm />

                {isMounted && (
                  <div className="grid grid-cols-1 gap-3">
                    <SocialButtons />
                  </div>
                )}

                <p className="mt-8 text-center text-sm text-muted-foreground">
                  <button
                    onClick={() => setViewState('greeting')}
                    className="text-xs hover:text-foreground transition-colors mb-4 block mx-auto underline-offset-4 hover:underline"
                  >
                    ← Voltar para o início
                  </button>
                  Ainda não tem uma conta?{' '}
                  <Link href="/register" className="font-semibold text-primary hover:underline decoration-primary/30 underline-offset-4">
                    Cadastre-se gratuitamente
                  </Link>
                </p>

                {/* Termos e Políticas - Vista de Formulário */}
                <div className="mt-8 pt-6 border-t border-primary/10 text-center text-sm text-gray-800">
                  Ao entrar, você concorda com nossos{" "}
                  <Link href="/terms" className="underline text-primary hover:text-primary/80 transition-colors">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link href="/privacy" className="underline text-primary hover:text-primary/80 transition-colors">
                    Política de Privacidade
                  </Link>
                  .
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

const DynamicLoginPageContent = dynamic(() => Promise.resolve(LoginPageContent), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Carregando Master IA...</p>
      </div>
    </div>
  ),
});

export default function LoginPage() {
  return <DynamicLoginPageContent />;
}
