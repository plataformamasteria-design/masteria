
import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, Copy, Eye, EyeOff, Info } from 'lucide-react';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useSession } from '@/contexts/session-context';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';

export function WebhookInfoCard() {
    const [isUrlCopied, setIsUrlCopied] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const { session } = useSession();
    const webhookSlug = session?.userData?.company?.webhookSlug || '...';

    // Fallback logic
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || 'https://masteria.app');
    const webhookUrl = `${baseUrl}/api/webhooks/meta/${webhookSlug}`;

    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setIsUrlCopied(true);
        notify.success('URL Copiada!', 'A URL do webhook foi copiada.');
        setTimeout(() => setIsUrlCopied(false), 2000);
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="webhook-info" className="border rounded-lg bg-card px-4">
                    <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Info className="h-4 w-4 text-primary" />
                            <span>Configuração do Webhook da Meta</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 pt-1">
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Use a URL abaixo para configurar o webhook no Painel de Desenvolvedores da Meta.
                                Tokens de verificação são tratados automaticamente.
                            </p>
                            <div>
                                <Label htmlFor="webhook-url" className="text-xs font-semibold mb-1.5 block">URL de Callback</Label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="webhook-url"
                                            readOnly
                                            type={isVisible ? "text" : "password"}
                                            value={webhookUrl}
                                            className="font-mono text-xs h-9 pr-10"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                            onClick={() => setIsVisible(!isVisible)}
                                        >
                                            {isVisible ? (
                                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </Button>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0 h-9 w-9"
                                        onClick={() => handleCopy(webhookUrl)}
                                    >
                                        {isUrlCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    );
}
