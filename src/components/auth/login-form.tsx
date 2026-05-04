'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
    const router = useRouter();
    const { toast } = useToast();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            // Get response text first to handle non-JSON errors (like 500 HTML pages or rate limits)
            const responseText = await response.text();
            let data: any = {};

            try {
                if (responseText) {
                    data = JSON.parse(responseText);
                }
            } catch (parseError) {
                console.error('Failed to parse response as JSON:', responseText.substring(0, 100));
                // If parsing fails but response is OK, it's an unexpected state
                if (response.ok) {
                    throw new Error('Resposta do servidor inválida.');
                }
                // If parsing fails for an error response, use generic message or status text
                throw new Error(`Erro no servidor (${response.status}): ${response.statusText || 'Resposta não formatada.'}`);
            }

            if (!response.ok) {
                // If it's a 429 (Rate Limit) from middleware, it might have a specific message
                if (response.status === 429) {
                    throw new Error(data.message || 'Muitas tentativas. Por favor, aguarde um pouco.');
                }
                throw new Error(data.error || data.message || `Falha no login (${response.status}).`);
            }

            toast({ title: "Login bem-sucedido!", description: "A redirecionar para o painel de controlo..." });

            // Redirecionar para dashboard para qualquer usuário
            router.push('/dashboard');

        } catch (err) {
            console.error('Login error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido ao tentar entrar.';
            toast({
                variant: 'destructive',
                title: 'Erro de Login',
                description: errorMessage,
            })
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin} method="post" action="/api/v1/auth/login" className="space-y-6">
            <div className="space-y-4">
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
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                            Esqueceu sua senha?
                        </Link>
                    </div>
                    <div className="relative">
                        <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required placeholder="password" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
        </form>
    );
}
