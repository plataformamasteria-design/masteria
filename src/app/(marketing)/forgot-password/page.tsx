
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { BotMessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import { useToast } from '@/hooks/use-toast';
import { requestPasswordReset } from '@/app/actions';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
        const result = await requestPasswordReset(email);

        if (!result.success) {
            throw new Error(result.message);
        }

        setIsSubmitted(true);
        toast({
            title: 'Link de Recuperação Enviado!',
            description: result.message,
        });

    } catch (error) {
         toast({
            variant: 'destructive',
            title: 'Erro',
            description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.',
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <div className="w-full min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
            <div className="flex justify-center">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
                    <BotMessageSquare className="h-7 w-7 text-primary" />
                    <span>Master IA</span>
                </Link>
            </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-center">Esqueceu sua senha?</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Sem problemas. Insira seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {isSubmitted ? (
            <div className="text-center p-4 bg-muted rounded-lg">
                <p className="font-medium">Verifique seu e-mail</p>
                <p className="text-sm text-muted-foreground">
                    Se a conta existir, um link de recuperação foi enviado para o endereço fornecido.
                </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="nome@exemplo.com"
                    required
                />
                </div>
                <Button className="w-full" type="submit" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enviar Link de Recuperação'}
                </Button>
            </form>
          )}

          <p className="text-sm text-center text-muted-foreground">
            Lembrou sua senha?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
      <ThemeToggle />
    </>
  );
}
