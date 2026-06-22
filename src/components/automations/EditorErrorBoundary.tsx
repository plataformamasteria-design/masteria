'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    children: React.ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class EditorErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('EditorErrorBoundary capturou um erro:', error, errorInfo);
        this.setState({ errorInfo });
        // Podemos também enviar isso automaticamente para o Supabase ou Logging depois.
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-zinc-900/50 p-6">
                    <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
                        <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                            <h2 className="text-lg font-bold text-red-700">Erro Interno no Editor</h2>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-slate-600 dark:text-zinc-300 text-sm">
                                Encontramos um problema inesperado ao renderizar este fluxo. Copie as informações abaixo e envie para o suporte para correções imediatas:
                            </p>

                            <div className="bg-slate-900 rounded-md p-4 overflow-x-auto text-[11px] font-mono text-emerald-400">
                                <p className="text-red-400 font-bold mb-2">{this.state.error?.toString()}</p>
                                <pre className="whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
                            </div>

                            <div className="flex items-center justify-end pt-4">
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Recarregar Tela
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
