
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BrainCircuit, Eye, Ear, Hand, Zap, Turtle, Gauge, Activity, Heart, Crown, Shield, Users, Lightbulb, Trophy } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NeurolinguisticProfileProps {
    vakProfile?: string | null;
    dominantSocialNeed?: string | null;
    communicationPace?: string | null;
    variant?: 'default' | 'compact';
}

export function NeurolinguisticCard({ vakProfile, dominantSocialNeed, communicationPace, variant = 'default' }: NeurolinguisticProfileProps) {
    // Helpers para VAK
    const getVakConfig = (profile: string) => {
        switch (profile?.toUpperCase()) {
            case 'VISUAL':
                return { label: 'Visual', icon: Eye, color: 'bg-blue-500', desc: 'Processa informações por imagens. Use palavras como "veja", "claro", "brilhante". Envie fotos e vídeos.' };
            case 'AUDITORY':
                return { label: 'Auditivo', icon: Ear, color: 'bg-green-500', desc: 'Foca no som e palavras. Use "escute", "soa bem", "conversa". Prefere áudios e ligações.' };
            case 'KINESTHETIC':
                return { label: 'Cinestésico', icon: Hand, color: 'bg-orange-500', desc: 'Foca em sensações e sentimentos. Use "sinto", "concreto", "pesado". Prefere experiências práticas.' };
            case 'DIGITAL':
                return { label: 'Digital', icon: BrainCircuit, color: 'bg-purple-500', desc: 'Lógico e analítico. Foca em dados, fatos e sentido. Evite emoções exageradas.' };
            default:
                return { label: 'Não Identificado', icon: BrainCircuit, color: 'bg-gray-400', desc: 'Ainda não há dados suficientes para determinar o perfil.' };
        }
    };

    // Helpers para Social Need
    const getNeedConfig = (need: string) => {
        switch (need?.toUpperCase()) {
            case 'SIGNIFICANCE': return { label: 'Significância', icon: Trophy, desc: 'Deseja ser único, especial e reconhecido.' };
            case 'CERTAINTY': return { label: 'Segurança', icon: Shield, desc: 'Busca previsibilidade, conforto e garantias.' };
            case 'CONNECTION': return { label: 'Conexão/Amor', icon: Heart, desc: 'Busca aceitação, relacionamentos e proximidade.' };
            case 'VARIETY': return { label: 'Variedade', icon: Activity, desc: 'Busca novidade, mudança e desafios.' };
            case 'GROWTH': return { label: 'Crescimento', icon: Lightbulb, desc: 'Focado em aprender, evoluir e melhorar.' };
            case 'CONTRIBUTION': return { label: 'Contribuição', icon: Users, desc: 'Focado em ajudar, servir e fazer a diferença.' };
            case 'POWER': return { label: 'Poder', icon: Crown, desc: 'Deseja controle, liderança e autoridade.' };
            default: return { label: 'Não Identificado', icon: BrainCircuit, desc: 'Ainda não há dados suficientes.' };
        }
    };

    // Helpers para Pace
    const getPaceConfig = (pace: string) => {
        switch (pace?.toUpperCase()) {
            case 'FAST': return { label: 'Rápido', icon: Zap, color: 'text-red-500', desc: 'Responde rápido e curto. Seja direto e ágil.' };
            case 'SLOW': return { label: 'Lento', icon: Turtle, color: 'text-green-500', desc: 'Demora para responder, textos longos. Tenha paciência e detalhe mais.' };
            case 'MODERATE': return { label: 'Moderado', icon: Gauge, color: 'text-yellow-600', desc: 'Ritmo padrão de conversa.' };
            default: return { label: 'Não Identificado', icon: Gauge, color: 'text-muted-foreground', desc: 'Ainda não há dados suficientes.' };
        }
    };

    const vak = getVakConfig(vakProfile || '');
    const need = getNeedConfig(dominantSocialNeed || '');
    const pace = getPaceConfig(communicationPace || '');
    const VakIcon = vak.icon;
    const NeedIcon = need.icon;
    const PaceIcon = pace.icon;

    if (!vakProfile && !dominantSocialNeed && !communicationPace) {
        return null; // Não exibe se não tiver dados
    }

    if (variant === 'compact') {
        return (
            <Card className="border-l-4 border-l-primary bg-muted/20">
                <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <BrainCircuit className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Inteligência Comportamental</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge className={`${vak.color} hover:${vak.color} text-white gap-1 pl-1.5 justify-center h-6`}>
                                        <VakIcon className="h-3 w-3" />
                                        {vak.label}
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[200px] text-xs">
                                    <p>{vak.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-1.5 font-medium text-xs border rounded h-6 bg-background px-2">
                                        <NeedIcon className="h-3 w-3 text-primary" />
                                        {need.label}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[200px] text-xs">
                                    <p>{need.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <div className="col-span-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className={`flex items-center justify-center gap-1.5 font-medium text-xs border rounded h-6 bg-background px-2 w-full ${pace.color}`}>
                                            <PaceIcon className="h-3 w-3" />
                                            Ritmo: {pace.label}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-[200px] text-xs">
                                        <p>{pace.desc}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-l-4 border-l-primary">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    Inteligência Comportamental (IA)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* VAK Profile */}
                    <div className="flex flex-col gap-1 p-3 bg-card dark:bg-card rounded-lg shadow-sm border">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canal (VAK)</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help">
                                        <Badge className={`${vak.color} hover:${vak.color} text-white gap-1 pl-1.5`}>
                                            <VakIcon className="h-3.5 w-3.5" />
                                            {vak.label}
                                        </Badge>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>{vak.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Social Need */}
                    <div className="flex flex-col gap-1 p-3 bg-card dark:bg-card rounded-lg shadow-sm border">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Motivação</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help">
                                        <div className="flex items-center gap-1.5 font-medium text-sm">
                                            <NeedIcon className="h-4 w-4 text-primary" />
                                            {need.label}
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>{need.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Communication Pace */}
                    <div className="flex flex-col gap-1 p-3 bg-card dark:bg-card rounded-lg shadow-sm border">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ritmo</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help">
                                        <div className={`flex items-center gap-1.5 font-medium text-sm ${pace.color}`}>
                                            <PaceIcon className="h-4 w-4" />
                                            {pace.label}
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>{pace.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
