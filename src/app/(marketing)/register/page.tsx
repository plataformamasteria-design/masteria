
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BotMessageSquare, Eye, EyeOff, XCircle, CheckCircle, Loader2, Quote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useRef } from 'react';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay"
  
const PasswordStrengthIndicator = ({ checks, className }: { checks: {label: string, valid: boolean}[], className?: string }) => {
    const strength = checks.filter(c => c.valid).length;
    const strengthText = ['Muito Fraca', 'Fraca', 'Média', 'Forte', 'Muito Forte'];
    const strengthColor = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];

    return (
        <div className={cn("p-4 border rounded-md mt-2 space-y-3", className)}>
            <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all duration-300", strength > 0 && strengthColor[strength - 1])} style={{width: `${(strength / (checks.length || 1)) * 100}%`}} />
                </div>
                <span className="text-sm font-medium">{strengthText[strength - 1]}</span>
            </div>
            <div className="space-y-1">
                {checks.map(check => (
                     <div key={check.label} className={cn("flex items-center gap-2 text-xs", check.valid ? 'text-green-600' : 'text-muted-foreground')}>
                        {check.valid ? <CheckCircle className="h-3 w-3"/> : <XCircle className="h-3 w-3"/>}
                        <span>{check.label}</span>
                     </div>
                ))}
            </div>
        </div>
    )
}

const marketingQuotes = [
    {
        quote: "O objetivo do marketing é conhecer e entender o cliente tão bem que o produto ou serviço se vende sozinho.",
        author: "Peter Drucker"
    },
    {
        quote: "Marketing não é sobre as coisas que você faz, mas sobre as histórias que você conta.",
        author: "Seth Godin"
    },
    {
        quote: "As pessoas não compram o que você faz, elas compram o porquê você faz.",
        author: "Simon Sinek"
    },
    {
        quote: "A melhor publicidade é a que os clientes satisfeitos fazem.",
        author: "Philip Kotler"
    },
    {
        quote: "O ótimo marketing faz o cliente se sentir inteligente.",
        author: "Joe Chernov"
    }
];

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const plugin = useRef(
    Autoplay({ delay: 7000, stopOnInteraction: false, stopOnMouseEnter: true })
  )
  
  const passwordChecks = useMemo(() => {
    return [
      { label: 'Pelo menos 8 caracteres', valid: password.length >= 8 },
      { label: 'Pelo menos uma letra maiúscula', valid: /[A-Z]/.test(password) },
      { label: 'Pelo menos uma letra minúscula', valid: /[a-z]/.test(password) },
      { label: 'Pelo menos um número', valid: /[0-9]/.test(password) },
    ];
  }, [password]);

  const isPasswordStrong = passwordChecks.every(c => c.valid);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isPasswordStrong) {
      setError('Sua senha não atende aos requisitos de segurança.');
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setIsLoading(false);
      return;
    }
    
    const formData = new FormData(e.currentTarget);
    const name = formData.get('fullname') as string;
    const email = formData.get('email') as string;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao criar a conta.');
        }

        if (data.warning === 'email_delivery_failed') {
            toast({
                title: "Conta criada com aviso",
                description: "Sua conta foi criada, mas houve uma instabilidade no disparo do e-mail de ativação. Se não recebê-lo em instantes, contate o suporte.",
                variant: "destructive",
            });
        } else {
            toast({
                title: "Conta criada com sucesso!",
                description: "Pode agora fazer login com as suas credenciais.",
            });
        }
        
        router.push('/login');

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center relative py-12" suppressHydrationWarning>
      {/* Main Content Container with Glassmorphism */}
      <div className="w-full max-w-xl relative z-10 px-6">
        <div className="bg-black/[0.03] dark:bg-zinc-900/40 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-2xl rounded-3xl p-8 sm:p-10 space-y-8">
          
          <div className="text-center">
             <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
               <BotMessageSquare className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
             </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground dark:text-white">Crie sua conta grátis</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Comece em segundos e explore todo o potencial da IA.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="fullname">Nome completo</Label>
              <Input id="fullname" name="fullname" type="text" placeholder="Seu nome completo" required />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="nome@exemplo.com" required />
            </div>
            
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Criar senha</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {isPasswordFocused && <PasswordStrengthIndicator checks={passwordChecks} className="bg-white/50 dark:bg-zinc-950/50 border-black/10 dark:border-white/10" />}
            </div>

             <div className="space-y-2 text-left">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <div className="relative">
                <Input 
                  id="confirm-password" 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground">
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            {error && <p className="text-sm text-red-600 dark:text-red-400 font-medium bg-red-100 dark:bg-red-400/10 p-3 rounded-lg border border-red-200 dark:border-red-400/20">{error}</p>}

            <div className="flex items-center space-x-2 pt-2">
                <Checkbox id="terms" required className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none text-zinc-600 dark:text-zinc-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Eu li e aceito os <Link href="/termos" className="text-emerald-500 dark:text-emerald-400 hover:underline">Termos de Serviço</Link> e a <Link href="/politicas" className="text-emerald-500 dark:text-emerald-400 hover:underline">Política de Privacidade</Link>.
                </label>
            </div>

            <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-zinc-950 font-bold rounded-xl mt-4 transition-colors" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Criar Conta Agora"}
            </Button>
          </form>

          <p className="text-sm text-center text-zinc-600 dark:text-zinc-400 pt-4 border-t border-black/10 dark:border-white/5">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-emerald-500 dark:text-emerald-400 hover:underline">
                Faça login aqui
              </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
