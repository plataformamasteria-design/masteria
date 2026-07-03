'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { getSuperadminBoards, createSuperadminBoard, deleteSuperadminBoard, updateSuperadminBoard } from '@/app/actions/superadmin-boards-actions';
import { SmartDataGrid } from './smart-data-grid';
import { Button } from '@/components/ui/button';
import { Plus, Table2, Trash2, Loader2, MoreVertical, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const fetcher = async () => {
    const res = await getSuperadminBoards();
    if (!res.success) throw new Error(res.error);
    return res.data;
};

export function SpreadsheetsTab() {
    const { data: boards, error, mutate, isLoading } = useSWR('superadmin-boards', fetcher);
    const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (boards && boards.length > 0 && !selectedBoardId) {
            setSelectedBoardId(boards[0].id);
        }
    }, [boards, selectedBoardId]);

    const handleCreateBoard = async () => {
        setIsCreating(true);
        const res = await createSuperadminBoard("Nova Planilha");
        setIsCreating(false);
        if (res.success && res.data) {
            toast.success("Planilha criada com sucesso!");
            mutate();
            setSelectedBoardId(res.data.id);
        } else {
            toast.error("Erro ao criar planilha: " + res.error);
        }
    };

    const handleDeleteBoard = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm("Tem certeza que deseja apagar esta planilha inteira?")) return;
        
        toast.loading("Apagando planilha...", { id: "delete-board" });
        const res = await deleteSuperadminBoard(id);
        if (res.success) {
            toast.success("Planilha apagada.", { id: "delete-board" });
            if (selectedBoardId === id) setSelectedBoardId(null);
            mutate();
        } else {
            toast.error("Erro ao apagar: " + res.error, { id: "delete-board" });
        }
    };

    const handleSaveName = async (board: any) => {
        if (!editName || editName === board.name) {
            setEditingBoardId(null);
            return;
        }
        
        const res = await updateSuperadminBoard(board.id, editName, board.columns, board.rows);
        if (res.success) {
            toast.success("Nome atualizado!");
            mutate();
        } else {
            toast.error("Erro ao renomear: " + res.error);
        }
        setEditingBoardId(null);
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 text-center text-destructive">
                Erro ao carregar planilhas: {error.message}
            </div>
        );
    }

    const selectedBoard = boards?.find(b => b.id === selectedBoardId);

    return (
        <div className="flex h-full w-full max-w-7xl mx-auto py-6">
            {/* Sidebar de Planilhas */}
            <div className="w-64 shrink-0 flex flex-col pr-6 border-r border-border/20">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Table2 className="h-4 w-4" />
                        Planilhas
                    </h3>
                    <Button size="icon" variant="ghost" onClick={handleCreateBoard} disabled={isCreating} className="h-7 w-7 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                        {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto">
                    {boards?.length === 0 && (
                        <div className="text-xs text-muted-foreground opacity-70 p-2 text-center">Nenhuma planilha criada.</div>
                    )}
                    {boards?.map(board => (
                        <div 
                            key={board.id} 
                            onClick={() => setSelectedBoardId(board.id)}
                            className={cn(
                                "group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border",
                                selectedBoardId === board.id 
                                    ? "bg-primary/10 border-primary/20 text-primary shadow-sm" 
                                    : "bg-transparent border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {editingBoardId === board.id ? (
                                <Input 
                                    autoFocus
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={() => handleSaveName(board)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName(board)}
                                    className="h-6 text-sm px-1 py-0 bg-background/50"
                                />
                            ) : (
                                <span className="text-sm font-semibold truncate flex-1">{board.name}</span>
                            )}

                            {editingBoardId !== board.id && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <MoreVertical className="h-3.5 w-3.5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32">
                                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditName(board.name); setEditingBoardId(board.id); }} className="text-xs">
                                            <PencilLine className="h-3.5 w-3.5 mr-2" /> Renomear
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => handleDeleteBoard(board.id, e)} className="text-xs text-destructive focus:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Deletar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Área Principal - Grid */}
            <div className="flex-1 pl-6 overflow-hidden flex flex-col h-full min-h-[500px]">
                {selectedBoard ? (
                    <SmartDataGrid 
                        key={selectedBoard.id} 
                        board={selectedBoard} 
                        onUpdate={() => mutate()} 
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 rounded-2xl border border-dashed border-border/50">
                        <Table2 className="h-12 w-12 mb-4 opacity-20" />
                        <p className="font-medium text-lg">Nenhuma planilha selecionada</p>
                        <p className="text-sm opacity-60">Selecione uma planilha ao lado ou crie uma nova.</p>
                        <Button variant="outline" className="mt-4 gap-2" onClick={handleCreateBoard}>
                            <Plus className="h-4 w-4" /> Criar Primeira Planilha
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
