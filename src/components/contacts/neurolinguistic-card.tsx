
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
                return { label: 'Visual', icon: Eye, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20', desc: 'Processa informações por imagens. Use palavras como "veja", "claro", "brilhante". Envie fotos e vídeos.' };
            case 'AUDITORY':
                return { label: 'Auditivo', icon: Ear, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: 'Foca no som e palavras. Use "escute", "soa bem", "conversa". Prefere áudios e ligações.' };
            case 'KINESTHETIC':
                return { label: 'Cinestésico', icon: Hand, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20', desc: 'Foca em sensações e sentimentos. Use "sinto", "concreto", "pesado". Prefere experiências práticas.' };
            case 'DIGITAL':
                return { label: 'Digital', icon: BrainCircuit, color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20', desc: 'Lógico e analítico. Foca em dados, fatos e sentido. Evite emoções exageradas.' };
            default:
                return { label: 'Não Identificado', icon: BrainCircuit, color: 'text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20', desc: 'Ainda não há dados suficientes para determinar o perfil.' };
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
            case 'FAST': return { label: 'Rápido', icon: Zap, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20', desc: 'Responde rápido e curto. Seja direto e ágil.' };
            case 'SLOW': return { label: 'Lento', icon: Turtle, color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/20', desc: 'Demora para responder, textos longos. Tenha paciência e detalhe mais.' };
            case 'MODERATE': return { label: 'Moderado', icon: Gauge, color: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20', desc: 'Ritmo padrão de conversa.' };
            default: return { label: 'Não Identificado', icon: Gauge, color: 'text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20', desc: 'Ainda não há dados suficientes.' };
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
            <Card className="border border-black/5 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-950/40 backdrop-blur-md saturate-150 shadow-sm overflow-hidden rounded-xl">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <BrainCircuit className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        <span className="text-sm font-black tracking-tight text-foreground/90">
                            Inteligência Comportamental
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={`flex items-center justify-center gap-1.5 font-medium text-xs border rounded-lg h-7 px-2 transition-colors cursor-help ${vak.color}`}>
                                        <VakIcon className="h-3.5 w-3.5" />
                                        {vak.label}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-[200px] text-xs">
                                    <p>{vak.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-1.5 font-medium text-xs border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 rounded-lg h-7 px-2 text-zinc-700 dark:text-zinc-300 transition-colors cursor-help">
                                        <NeedIcon className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                                        <span className="truncate">{need.label}</span>
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
                                        <div className={`flex items-center justify-center gap-1.5 font-medium text-xs border rounded-lg h-7 px-2 w-full transition-colors cursor-help ${pace.color}`}>
                                            <PaceIcon className="h-3.5 w-3.5" />
                                            <span>Ritmo: {pace.label}</span>
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
        <Card className="border border-black/5 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-zinc-950/40 backdrop-blur-md saturate-150 shadow-sm overflow-hidden rounded-xl">
            <CardHeader className="pb-3 border-b border-black/5 dark:border-white/5">
                <CardTitle className="text-base flex items-center gap-2 font-black tracking-tight text-foreground/90">
                    <BrainCircuit className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                    Inteligência Comportamental (IA)
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* VAK Profile */}
                    <div className="flex flex-col gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Canal (VAK)</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help w-fit">
                                        <div className={`flex items-center gap-1.5 font-medium text-sm border rounded-lg h-8 px-2.5 transition-colors ${vak.color}`}>
                                            <VakIcon className="h-4 w-4" />
                                            {vak.label}
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>{vak.desc}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    {/* Social Need */}
                    <div className="flex flex-col gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Motivação</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help w-fit">
                                        <div className="flex items-center gap-1.5 font-medium text-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg h-8 px-2.5 text-zinc-700 dark:text-zinc-300 transition-colors">
                                            <NeedIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
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
                    <div className="flex flex-col gap-2 p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl shadow-sm border border-zinc-200/50 dark:border-zinc-800/50">
                        <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Ritmo</span>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2 cursor-help w-fit">
                                        <div className={`flex items-center gap-1.5 font-medium text-sm border rounded-lg h-8 px-2.5 transition-colors ${pace.color}`}>
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
