import { Button } from '@/components/ui/button';
import { Tags, Download, Trash2, X } from 'lucide-react';

interface ContactsBulkActionsProps {
    selectedCount: number;
    onClearSelection: () => void;
    onDelete: () => void;
    // Add other actions as needed
}

export function ContactsBulkActions({ selectedCount, onClearSelection, onDelete }: ContactsBulkActionsProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4 animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="bg-foreground text-background rounded-full shadow-lg border p-2 pl-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{selectedCount} selecionado(s)</span>
                    <div className="h-4 w-px bg-background/20" />
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 hover:bg-background/20 hover:text-background text-background/90">
                            <Tags className="mr-2 h-4 w-4" />
                            Tag
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 hover:bg-background/20 hover:text-background text-background/90">
                            <Download className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 hover:bg-red-500/20 hover:text-red-400 text-red-400"
                            onClick={onDelete}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                        </Button>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-background/20 text-background/80 hover:text-background"
                    onClick={onClearSelection}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// Also keeping the inline version-ish style for standard table toolbars if preferred,
// but the floating action bar is more modern/High-Density standard.
// For now, I'll stick to this floating island design.
