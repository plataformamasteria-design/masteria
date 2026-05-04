
'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, BotMessageSquare, Quote } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/landing/theme-toggle';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
  } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay"


type VerificationStatus = 'verifying' | 'success' | 'error';

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

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<VerificationStatus>('verifying');
    const [errorMessage, setErrorMessage] = useState('');
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        if (!token) {
            setErrorMessage('Token de verificação não encontrado.');
            setStatus('error');
            return;
        }

        const verifyToken = async () => {
            if (isVerified) return;

            try {
                const response = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Falha ao verificar o e-mail. O token pode ser inválido ou já ter sido utilizado.');
                }
                
                setIsVerified(true);
                setStatus('success');

                // Redirect to dashboard after successful verification
                setTimeout(() => {
                    router.push(data.redirectTo || '/dashboard');
                }, 3000);

            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
                setStatus('error');
            }
        };

        verifyToken();
    }, [token, router, isVerified]);

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">
                    {status === 'verifying' && 'A verificar o seu e-mail...'}
                    {status === 'success' && 'E-mail Confirmado!'}
                    {status === 'error' && 'Erro na Verificação'}
                </CardTitle>
                <CardDescription>
                     {status === 'verifying' && 'Por favor, aguarde um momento.'}
                     {status === 'success' && 'Sua conta foi ativada. A redirecionar para o painel...'}
                     {status === 'error' && errorMessage}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-6 p-10">
                {status === 'verifying' && <Loader2 className="h-16 w-16 animate-spin text-primary" />}
                {status === 'success' && <CheckCircle className="h-16 w-16 text-green-500" />}
                {status === 'error' && <XCircle className="h-16 w-16 text-destructive" />}

                {status === 'error' && (
                    <Link href="/login" passHref>
                        <Button variant="outline">
                            Ir para a Página de Login
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}


export default function VerifyEmailPage() {
    const plugin = useRef(
        Autoplay({ delay: 7000, stopOnInteraction: false, stopOnMouseEnter: true })
    )

  return (
    <>
    <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-2">
         <div className="hidden lg:flex flex-col items-center justify-center bg-muted/40 p-10 text-center space-y-6">
            <div className="flex items-center gap-4 text-primary">
            <BotMessageSquare className="h-12 w-12" />
            <h1 className="text-4xl font-bold text-foreground">Master IA</h1>
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
        <div className="w-full flex items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 text-center">
                <div className="flex justify-center">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
                        <BotMessageSquare className="h-7 w-7 text-primary" />
                        <span>Master IA</span>
                    </Link>
                </div>
                <Suspense fallback={<Loader2 className="h-16 w-16 animate-spin" />}>
                    <VerifyEmailContent />
                </Suspense>
            </div>
        </div>
    </div>
      <ThemeToggle />
    </>
  );
}
