import React from 'react';
import { Instagram, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMetaConnectionStatus } from '@/hooks/useMetaConnectionStatus';
import { useNavigate } from 'react-router-dom';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function InstagramConnectionStatus() {
    const { hasInstagram, instagramUsername, loading, refresh } = useMetaConnectionStatus();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="flex items-center justify-center w-8 h-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <button
                                className={cn(
                                    "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300",
                                    "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20",
                                    hasInstagram && "hover:ring-2 hover:ring-pink-500/20"
                                )}
                            >
                                {hasInstagram ? (
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-pink-500/20 animate-ping" />
                                        <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 shadow-lg shadow-pink-500/30">
                                            <Instagram className="h-3 w-3 text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg shadow-gray-500/20">
                                        <Instagram className="h-3 w-3 text-white" />
                                    </div>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                        {hasInstagram
                            ? `Instagram conectado${instagramUsername ? ` (@${instagramUsername})` : ''}`
                            : 'Instagram desconectado'}
                    </TooltipContent>
                </Tooltip>

                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => refresh()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Verificar status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/profile?tab=integracoes')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {hasInstagram ? 'Ver conexão' : 'Configurar conexão'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    );
}
