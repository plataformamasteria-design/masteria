

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, MoreHorizontal, Loader2, Trash2, Edit, ChevronsRight, ChevronsLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { ContactList } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Textarea } from '../ui/textarea';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { UploadContactsConfirmDialog } from './upload-contacts-confirm-dialog';

export function ContactListsTable() {
    const [lists, setLists] = useState<ContactList[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingList, setEditingList] = useState<ContactList | null>(null);
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);
    const [newlyCreatedList, setNewlyCreatedList] = useState<ContactList | null>(null);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit, setLimit] = useState(10);
    const [search, setSearch] = useState('');

    const fetchLists = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            if (search) params.set('search', search);

            const response = await fetch(`/api/v1/lists?${params.toString()}`);
            if (!response.ok) throw new Error('Falha ao carregar as listas.');
            
            const data = await response.json();
            setLists(data.data || []);
            setTotalPages(data.totalPages || 1);

        } catch (error) {
                 notify.error('Erro', error instanceof Error ? error.message : 'Não foi possível carregar as listas.');
        } finally {
            setLoading(false);
        }
    }, [page, limit, search, notify]);

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchLists();
        }, 300);
        return () => clearTimeout(debounce);
    }, [fetchLists]);
    
    const handleOpenModal = (list: ContactList | null) => {
        setEditingList(list);
        setIsModalOpen(true);
    }
    
    const handleDeleteList = async (listId: string) => {
        try {
            const response = await fetch(`/api/v1/lists/${listId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Falha ao excluir a lista.');
            await fetchLists();
            notify.success('Lista Excluída', 'A lista de contatos foi removida com sucesso.');
        } catch (error) {
            notify.error('Erro', error instanceof Error ? error.message : 'Não foi possível excluir a lista.');
        }
    }

    const handleSaveList = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const listData = {
            name: formData.get('name') as string,
            description: formData.get('description') as string,
        };

        const isEditing = !!editingList;
        const url = isEditing ? `/api/v1/lists/${editingList.id}` : '/api/v1/lists';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(listData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao salvar a lista.');
            }

            const savedList: ContactList = await response.json();
            
            if (isEditing) {
                notify.success('Lista Atualizada!', `A lista "${savedList.name}" foi salva.`);
            } else {
                setNewlyCreatedList(savedList);
                setShowUploadConfirm(true);
            }
            
            await fetchLists();

        } catch (error) {
            notify.error('Erro ao Salvar', error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.');
        } finally{
            setIsModalOpen(false);
            setEditingList(null);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Buscar por nome ou descrição..."
                        className="pl-9 w-full bg-black/5 dark:bg-white/[0.02] border-black/10 dark:border-white/10 text-foreground dark:text-white placeholder:text-zinc-500 rounded-xl focus-visible:ring-emerald-500/30"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-auto sm:ml-auto">
                    <Button onClick={() => handleOpenModal(null)} className="w-full sm:w-auto rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1),inset_0_0_10px_rgba(16,185,129,0.1)] transition-all">
                        <PlusCircle className="mr-2 h-4 w-4 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        Criar Lista
                    </Button>
                </div>
            </div>
            
            <div className="glass-card rounded-[2rem] w-full overflow-hidden relative p-4 sm:p-6 mt-4">
                <div className="w-full overflow-auto custom-scrollbar">
                <Table className="min-w-[420px]">
                    <TableHeader className="bg-muted/50 dark:bg-black/20 border-b border-black/5 dark:border-white/5">
                        <TableRow className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] border-black/5 dark:border-white/5 transition-colors">
                            <TableHead className="min-w-[140px]">Nome da Lista</TableHead>
                            <TableHead className="w-[70px] text-center">Qtd</TableHead>
                            <TableHead className="w-[90px]">Data</TableHead>
                            <TableHead className="w-[50px] text-center">
                                <span className="sr-only">Ações</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                </TableCell>
                            </TableRow>
                        ) : lists.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">Nenhuma lista encontrada.</TableCell>
                            </TableRow>
                        ) : (
                            lists.map((list) => (
                                <TableRow key={list.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] border-black/5 dark:border-white/5 transition-colors">
                                    <TableCell>
                                        <div className="font-medium">{list.name}</div>
                                        {list.description && (
                                            <div className="text-sm text-muted-foreground line-clamp-1">{list.description}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">{list.contactCount}</TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">{list.createdAt ? new Date(list.createdAt).toLocaleDateString('pt-BR') : '-'}</TableCell>
                                    <TableCell className="text-center p-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => handleOpenModal(list)}>
                                                    <Edit className="mr-2 h-4 w-4"/>Editar
                                                </DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4"/>Excluir
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                            <AlertDialogDescription>Esta ação não pode ser desfeita e excluirá permanentemente a lista &quot;{list.name}&quot;.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteList(list.id)}>Sim, Excluir</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
                <div className="text-sm text-muted-foreground order-2 sm:order-1">
                    Página {page} de {totalPages}.
                </div>
                <div className="flex items-center gap-2 order-1 sm:order-2 flex-wrap justify-center">
                    <Select value={limit.toString()} onValueChange={(value) => {setLimit(parseInt(value, 10)); setPage(1);}}>
                        <SelectTrigger className="w-[100px] h-9">
                            <SelectValue placeholder="10 por..." />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 20, 50].map(val => (
                                <SelectItem key={val} value={val.toString()}>{val} por...</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPage(1)} disabled={page === 1}>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingList ? 'Editar Lista' : 'Criar Nova Lista'}</DialogTitle>
                        <DialogDescription>
                            Dê um nome e uma descrição para a sua lista de contatos.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveList}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="list-name">Nome da Lista</Label>
                                <Input id="list-name" name="name" placeholder="Ex: Clientes VIP" defaultValue={editingList?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="list-description">Descrição (Opcional)</Label>
                                <Textarea id="list-description" name="description" placeholder="Ex: Clientes que compraram nos últimos 30 dias" defaultValue={editingList?.description || ''} />
                            </div>
                        </div>
                         <DialogFooter>
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                            <Button type="submit">Salvar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            
            {newlyCreatedList && (
                <UploadContactsConfirmDialog
                    isOpen={showUploadConfirm}
                    onClose={() => {
                        setShowUploadConfirm(false);
                        setNewlyCreatedList(null);
                    }}
                    listName={newlyCreatedList.name}
                    listId={newlyCreatedList.id}
                    onUploadCompleted={fetchLists}
                />
            )}
        </div>
    );
}
