import React from 'react';
import { Facebook, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
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

// Ícone customizado do Messenger
function MessengerIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.2 5.42 3.15 7.2.16.15.26.36.27.58l.05 1.81c.02.56.59.93 1.11.71l2.02-.8c.17-.07.36-.08.54-.04.92.25 1.9.39 2.86.39 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm5.89 7.55l-2.88 4.57c-.46.73-1.44.91-2.12.39l-2.29-1.72a.56.56 0 00-.67 0L7.2 14.73c-.39.3-.9-.19-.64-.61l2.88-4.57c.46-.73 1.44-.91 2.12-.39l2.29 1.72a.56.56 0 00.67 0l2.73-1.94c.39-.3.9.19.64.61z" />
        </svg>
    );
}

export function MessengerConnectionStatus() {
    const { hasMessenger, pageName, loading, refresh } = useMetaConnectionStatus();
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
                                    hasMessenger && "hover:ring-2 hover:ring-blue-500/20"
                                )}
                            >
                                {hasMessenger ? (
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                                        <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/30">
                                            <MessengerIcon className="h-3.5 w-3.5 text-white" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg shadow-gray-500/20">
                                        <MessengerIcon className="h-3.5 w-3.5 text-white" />
                                    </div>
                                )}
                            </button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                        {hasMessenger
                            ? `Messenger conectado${pageName ? ` (${pageName})` : ''}`
                            : 'Messenger desconectado'}
                    </TooltipContent>
                </Tooltip>

                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => refresh()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Verificar status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/profile?tab=integracoes')}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {hasMessenger ? 'Ver conexão' : 'Configurar conexão'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TooltipProvider>
    );
}
