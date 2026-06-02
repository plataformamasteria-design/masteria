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
import { m as motion, AnimatePresence } from 'framer-motion';

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
      <div className="w-full min-h-screen flex items-center justify-center relative py-12" suppressHydrationWarning>
        <div className="absolute top-4 left-4 z-20">
          <VersionBadge prefix="v" />
        </div>

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
                className="bg-black/[0.03] dark:bg-zinc-900/40 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 space-y-8 text-center"
              >
                <div className="flex justify-center mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative bg-zinc-950/80 border border-emerald-500/30 p-6 rounded-3xl shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <Bot className="h-16 w-16 text-emerald-400" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl font-bold tracking-tight text-foreground dark:text-white">
                    Master <span className="text-emerald-500 dark:text-emerald-400">IA</span>
                  </h2>
                  <div className="h-12 flex items-center justify-center text-xl text-zinc-400 font-medium leading-relaxed">
                    {isMounted && "Olá! Sou o MasterIA, como posso ajudar você hoje?"}
                  </div>
                </div>

                <div className="grid gap-4 pt-8 max-w-sm mx-auto">
                  <Button
                    size="lg"
                    onClick={() => setViewState('login')}
                    className="group relative overflow-hidden h-14 text-base shadow-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all duration-300 w-full rounded-full font-bold"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Fazer Login
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleRegisterClick}
                    className="h-14 text-base hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300 w-full rounded-full border border-transparent hover:border-black/10 dark:hover:border-white/10 text-zinc-600 dark:text-zinc-300 hover:text-foreground dark:hover:text-white"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      Criar nova conta
                    </span>
                  </Button>
                </div>

                <div className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-500 bg-black/5 dark:bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-black/5 dark:border-white/5">
                  Ao entrar, você concorda com nossos{" "}
                  <Link href="/termos" className="underline text-emerald-400 hover:text-emerald-300 transition-colors">
                    Termos de Uso
                  </Link>{" "}
                  e{" "}
                  <Link href="/politicas" className="underline text-emerald-400 hover:text-emerald-300 transition-colors">
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
                className="bg-black/[0.03] dark:bg-zinc-900/40 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10"
              >
                <div className="mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <Bot className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">Bem-vindo de volta!</h2>
                  <p className="mt-2 text-sm text-zinc-400">
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
                  <div className="grid grid-cols-1 gap-3 mt-6">
                    <SocialButtons />
                  </div>
                )}

                <p className="mt-8 text-center text-sm text-zinc-400">
                  <button
                    onClick={() => setViewState('greeting')}
                    className="text-xs hover:text-white transition-colors mb-4 block mx-auto underline-offset-4 hover:underline"
                  >
                    ← Voltar
                  </button>
                  Ainda não tem uma conta?{' '}
                  <Link href="/register" className="font-semibold text-emerald-400 hover:underline decoration-emerald-400/30 underline-offset-4">
                    Cadastre-se gratuitamente
                  </Link>
                </p>
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
