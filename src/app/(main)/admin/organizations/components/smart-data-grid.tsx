'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical, Type, Hash, ListTodo, CalendarDays, Coins } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { updateSuperadminBoard } from '@/app/actions/superadmin-boards-actions';
import { toast } from 'sonner';

export type BoardColumnType = 'text' | 'number' | 'select' | 'date' | 'currency' | 'status';

export interface SuperadminBoardColumn {
    id: string;
    title: string;
    type: BoardColumnType;
    options?: string[];
}

interface SmartDataGridProps {
    board: {
        id: string;
        name: string;
        columns: SuperadminBoardColumn[];
        rows: Record<string, any>[];
    };
    onUpdate: () => void;
}

const TYPE_ICONS = {
    text: Type,
    number: Hash,
    select: ListTodo,
    status: ListTodo,
    date: CalendarDays,
    currency: Coins,
};

const DEFAULT_STATUS_COLORS: Record<string, string> = {
    'Pendente': 'bg-zinc-500/10 text-zinc-500',
    'Em Andamento': 'bg-blue-500/10 text-blue-500',
    'Concluído': 'bg-emerald-500/10 text-emerald-500',
    'Atrasado': 'bg-destructive/10 text-destructive',
};

export function SmartDataGrid({ board, onUpdate }: SmartDataGridProps) {
    const [columns, setColumns] = useState<SuperadminBoardColumn[]>(board.columns || []);
    const [rows, setRows] = useState<Record<string, any>[]>(board.rows || []);
    const [isSaving, setIsSaving] = useState(false);
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    // Sync state if props change (e.g. switching boards)
    useEffect(() => {
        setColumns(board.columns || []);
        setRows(board.rows || []);
    }, [board.id]);

    const saveChanges = useCallback(async (newCols: SuperadminBoardColumn[], newRows: Record<string, any>[]) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        
        // Optimistic UI save indicator
        setIsSaving(true);
        saveTimeout.current = setTimeout(async () => {
            const res = await updateSuperadminBoard(board.id, board.name, newCols, newRows);
            setIsSaving(false);
            if (!res.success) {
                toast.error("Erro ao salvar planilha: " + res.error);
            } else {
                onUpdate();
            }
        }, 800);
    }, [board.id, board.name, onUpdate]);

    const addColumn = (type: BoardColumnType) => {
        const newCol: SuperadminBoardColumn = {
            id: `col_${Date.now()}`,
            title: `Nova Coluna`,
            type,
            options: type === 'status' ? ['Pendente', 'Concluído'] : []
        };
        const updatedCols = [...columns, newCol];
        setColumns(updatedCols);
        saveChanges(updatedCols, rows);
    };

    const updateColumnTitle = (colId: string, title: string) => {
        const updatedCols = columns.map(c => c.id === colId ? { ...c, title } : c);
        setColumns(updatedCols);
        saveChanges(updatedCols, rows);
    };

    const deleteColumn = (colId: string) => {
        const updatedCols = columns.filter(c => c.id !== colId);
        // Also remove data from rows
        const updatedRows = rows.map(r => {
            const newRow = { ...r };
            delete newRow[colId];
            return newRow;
        });
        setColumns(updatedCols);
        setRows(updatedRows);
        saveChanges(updatedCols, updatedRows);
    };

    const addRow = () => {
        const newRow: Record<string, any> = { id: `row_${Date.now()}` };
        columns.forEach(c => newRow[c.id] = '');
        const updatedRows = [...rows, newRow];
        setRows(updatedRows);
        saveChanges(columns, updatedRows);
    };

    const updateCell = (rowId: string, colId: string, value: any) => {
        const updatedRows = rows.map(r => r.id === rowId ? { ...r, [colId]: value } : r);
        setRows(updatedRows);
        saveChanges(columns, updatedRows);
    };

    const deleteRow = (rowId: string) => {
        const updatedRows = rows.filter(r => r.id !== rowId);
        setRows(updatedRows);
        saveChanges(columns, updatedRows);
    };

    return (
        <div className="flex flex-col h-full bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-lg">{board.name}</h2>
                    {isSaving ? (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest animate-pulse">Salvando...</span>
                    ) : (
                        <span className="text-[10px] text-emerald-500 uppercase tracking-widest">Salvo</span>
                    )}
                </div>
                <Button size="sm" onClick={addRow} className="gap-2 h-8">
                    <Plus className="h-3.5 w-3.5" /> Nova Linha
                </Button>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="min-w-max">
                    {/* Headers */}
                    <div className="flex border-b border-border/50 bg-muted/40 sticky top-0 z-10">
                        <div className="w-12 border-r border-border/50 shrink-0 bg-muted/40" />
                        {columns.map(col => {
                            const Icon = TYPE_ICONS[col.type] || Type;
                            return (
                                <div key={col.id} className="w-48 border-r border-border/50 flex items-center shrink-0 group relative">
                                    <div className="px-3 py-2 flex items-center gap-2 w-full">
                                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <Input 
                                            value={col.title}
                                            onChange={(e) => updateColumnTitle(col.id, e.target.value)}
                                            className="h-6 px-1 border-transparent hover:border-border focus:border-primary bg-transparent text-sm font-semibold shadow-none rounded-sm transition-all"
                                        />
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <GripVertical className="h-3 w-3 text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40">
                                            <DropdownMenuItem onClick={() => deleteColumn(col.id)} className="text-destructive focus:text-destructive text-xs">
                                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Deletar Coluna
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            );
                        })}
                        
                        {/* Add Column Button */}
                        <div className="w-32 flex items-center px-2 shrink-0">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 w-full justify-start">
                                        <Plus className="h-3 w-3" /> Coluna
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => addColumn('text')} className="text-xs"><Type className="h-3.5 w-3.5 mr-2" /> Texto</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addColumn('number')} className="text-xs"><Hash className="h-3.5 w-3.5 mr-2" /> Número</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addColumn('currency')} className="text-xs"><Coins className="h-3.5 w-3.5 mr-2" /> Moeda</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addColumn('status')} className="text-xs"><ListTodo className="h-3.5 w-3.5 mr-2" /> Status</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => addColumn('date')} className="text-xs"><CalendarDays className="h-3.5 w-3.5 mr-2" /> Data</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Rows */}
                    <div className="flex flex-col">
                        {rows.map((row, index) => (
                            <div key={row.id} className="flex border-b border-border/50 group hover:bg-muted/10 transition-colors">
                                <div className="w-12 border-r border-border/50 shrink-0 flex items-center justify-center relative">
                                    <span className="text-xs text-muted-foreground group-hover:opacity-0 transition-opacity">{index + 1}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => deleteRow(row.id)}
                                        className="h-6 w-6 absolute opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                                {columns.map(col => (
                                    <div key={col.id} className="w-48 border-r border-border/50 shrink-0 p-1 flex items-center">
                                        <CellRenderer 
                                            column={col} 
                                            value={row[col.id] || ''} 
                                            onChange={(val) => updateCell(row.id, col.id, val)} 
                                        />
                                    </div>
                                ))}
                                <div className="w-32 shrink-0 bg-transparent" />
                            </div>
                        ))}
                        {rows.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center">
                                <ListTodo className="h-8 w-8 mb-2 opacity-20" />
                                Nenhuma linha adicionada.
                            </div>
                        )}
                        <div className="flex border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer" onClick={addRow}>
                             <div className="w-12 border-r border-border/50 shrink-0" />
                             <div className="flex items-center px-4 py-2 text-xs text-muted-foreground font-medium gap-2">
                                 <Plus className="h-3.5 w-3.5" /> Clique para adicionar
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CellRenderer({ column, value, onChange }: { column: SuperadminBoardColumn, value: any, onChange: (val: any) => void }) {
    if (column.type === 'status') {
        const options = column.options || ['Pendente', 'Em Andamento', 'Concluído'];
        const currentOption = value || '';
        
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className={cn(
                        "w-full h-full min-h-8 flex items-center px-2 text-sm rounded transition-colors text-left focus:outline-none focus:ring-1 focus:ring-primary/30",
                        !value && "hover:bg-muted/50 text-muted-foreground/50",
                    )}>
                        {value ? (
                            <Badge variant="outline" className={cn("font-medium border-transparent shrink-0", DEFAULT_STATUS_COLORS[value] || 'bg-zinc-100 text-zinc-800 dark:bg-white/10 dark:text-white')}>
                                {value}
                            </Badge>
                        ) : 'Vazio'}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                    {options.map(opt => (
                        <DropdownMenuItem key={opt} onClick={() => onChange(opt)} className="text-xs font-medium">
                            <Badge variant="outline" className={cn("mr-2 border-transparent", DEFAULT_STATUS_COLORS[opt] || 'bg-zinc-100 text-zinc-800 dark:bg-white/10 dark:text-white')}>
                                {opt}
                            </Badge>
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onClick={() => onChange('')} className="text-xs text-muted-foreground">Limpar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    if (column.type === 'currency') {
        return (
            <div className="relative w-full h-full flex items-center">
                <span className="absolute left-2 text-xs text-muted-foreground font-medium">R$</span>
                <Input 
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-full min-h-8 pl-7 border-transparent shadow-none hover:bg-muted/30 focus:bg-background focus:border-primary/50 text-sm font-medium rounded-sm transition-all"
                    placeholder="0,00"
                />
            </div>
        );
    }

    if (column.type === 'date') {
        return (
            <Input 
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-full min-h-8 border-transparent shadow-none hover:bg-muted/30 focus:bg-background focus:border-primary/50 text-sm rounded-sm transition-all"
            />
        );
    }

    return (
        <Input 
            type={column.type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-full min-h-8 border-transparent shadow-none hover:bg-muted/30 focus:bg-background focus:border-primary/50 text-sm rounded-sm transition-all"
            placeholder="..."
        />
    );
}
