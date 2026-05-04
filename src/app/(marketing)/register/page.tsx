
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

        toast({
            title: "Conta criada com sucesso!",
            description: "Pode agora fazer login com as suas credenciais.",
        });
        router.push('/login');

    } catch (err) {
        setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="hidden lg:flex flex-col items-center justify-center bg-muted/40 p-10 text-center space-y-6">
        <div className="flex items-center gap-4 text-primary">
          <BotMessageSquare className="h-12 w-12" />
          <h1 className="text-4xl font-bold text-foreground">ZAP Master</h1>
        </div>
        <Carousel
            opts={{
                loop: true,
                align: "start",
            }}
            plugins={[plugin.current]}
            className="w-full max-w-lg"
        >
          <CarouselContent>
            {marketingQuotes.map((item, index) => (
              <CarouselItem key={index}>
                <div className="p-1 text-center">
                    <Quote className="h-8 w-8 text-muted-foreground mb-4 mx-auto" />
                    <p className="text-xl font-medium text-foreground">&quot;{item.quote}&quot;</p>
                    <p className="text-sm text-muted-foreground mt-4">- {item.author}</p>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-center">Crie sua conta grátis</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                Comece em segundos e explore todo o potencial.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullname">Nome completo</Label>
              <Input id="fullname" name="fullname" type="text" placeholder="Seu nome completo" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="nome@exemplo.com" required />
            </div>
            
            <div className="space-y-2">
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
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {isPasswordFocused && <PasswordStrengthIndicator checks={passwordChecks} />}
            </div>

             <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <div className="relative">
                <Input 
                  id="confirm-password" 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  required 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center space-x-2">
                <Checkbox id="terms" required/>
                <label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    Eu li e aceito os <Link href="#" className="text-primary hover:underline">Termos de Serviço</Link> e a <Link href="#" className="text-primary hover:underline">Política de Privacidade</Link>.
                </label>
            </div>

            <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Criar Conta"}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Entre aqui
              </Link>
          </p>
        </div>
      </div>
    </div>
    <ThemeToggle />
    </>
  );
}
