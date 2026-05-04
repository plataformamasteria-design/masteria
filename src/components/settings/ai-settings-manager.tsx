
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import type { AiCredential } from '@/lib/types';
import { AiCredentialFormDialog } from './ai-credential-form-dialog';

type Provider = 'GEMINI';

const providerConfig = {
    GEMINI: { label: 'Google Gemini' }
}

export function AiSettingsManager() {
    const [credentials, setCredentials] = useState<AiCredential[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCredential, setEditingCredential] = useState<AiCredential | null>(null);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const fetchCredentials = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/v1/ia/credentials');
            if (!res.ok) throw new Error('Falha ao carregar credenciais.');
            const data = await res.json();
            setCredentials(data);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            setLoading(false);
        }
    }, [notify]);

    useEffect(() => {
        fetchCredentials();
    }, [fetchCredentials]);

    const handleOpenModal = (credential: AiCredential | null) => {
        setEditingCredential(credential);
        setIsModalOpen(true);
    }

    const handleDelete = async (credentialId: string) => {
        try {
            const response = await fetch(`/api/v1/ia/credentials/${credentialId}`, {
                method: 'DELETE',
            });
            if (response.status !== 204) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir a credencial.');
            }
            notify.success('Credencial Excluída!');
            fetchCredentials();
        } catch (error) {
            notify.error('Erro ao Excluir', (error as Error).message);
        }
    }

    return (
        <>
            <Card>
                <CardHeader className="flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <CardTitle>Credenciais de IA (BYOK)</CardTitle>
                        <CardDescription>Gerencie suas chaves de API (Bring Your Own Key) para diferentes provedores de IA.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenModal(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Credencial
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Provedor</TableHead>
                                    <TableHead>Chave de API</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : credentials.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-24">Nenhuma credencial adicionada.</TableCell></TableRow>
                                ) : (
                                    credentials.map(cred => (
                                        <TableRow key={cred.id} className="hover:bg-muted/40 transition-colors">
                                            <TableCell className="font-medium">{cred.name}</TableCell>
                                            <TableCell>{providerConfig[cred.provider as Provider]?.label || cred.provider}</TableCell>
                                            <TableCell className="font-mono text-xs">••••••••••••{cred.apiKey.slice(-4)}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleOpenModal(cred)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Excluir Credencial?</AlertDialogTitle>
                                                                    <AlertDialogDescription>A exclusão desta credencial pode afetar os Agentes de IA que a utilizam. Tem certeza?</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(cred.id)}>Sim, Excluir</AlertDialogAction>
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
                </CardContent>
            </Card>

            <AiCredentialFormDialog
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                credentialToEdit={editingCredential}
                onSaveSuccess={fetchCredentials}
            />
        </>
    );
}
