import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep console signal for debugging (prevents blank screen)
    console.error("[ErrorBoundary] Uncaught render error:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-5 space-y-3 shadow-xl">
          <h1 className="text-xl font-bold text-red-500">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">
            O app encontrou um erro inesperado. Por favor, tire um print do erro abaixo e envie para o suporte:
          </p>

          <div className="bg-black/90 p-4 rounded-md overflow-x-auto text-red-400 font-mono text-xs w-full max-h-[400px] overflow-y-auto whitespace-pre-wrap select-all">
            {this.state.error instanceof Error ? (
              <>
                <strong>{this.state.error.name}: {this.state.error.message}</strong>
                <br /><br />
                {this.state.error.stack}
              </>
            ) : (
              JSON.stringify(this.state.error, null, 2)
            )}
          </div>

          <div className="flex items-center gap-2 pt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Tentar continuar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
