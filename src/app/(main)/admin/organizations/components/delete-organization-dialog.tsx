'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { deleteOrganization } from '@/app/actions/superadmin-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { MasterOrg } from '@/app/actions/superadmin-actions';

interface DeleteOrganizationDialogProps {
    org: MasterOrg | null;
    open: boolean;
    onClose: () => void;
}

export function DeleteOrganizationDialog({ org, open, onClose }: DeleteOrganizationDialogProps) {
    const [loading, setLoading] = useState(false);
    const [confirmSlug, setConfirmSlug] = useState('');
    const router = useRouter();

    if (!org) return null;

    const isMatch = confirmSlug === org.slug;

    const handleDelete = async () => {
        if (!isMatch) return;
        setLoading(true);
        const res = await deleteOrganization(org.id);
        if (res.success) {
            toast.success('Organização destruída permanentemente!');
            router.refresh();
            onClose();
        } else {
            toast.error('Erro ao deletar: ' + res.error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-md bg-background border-destructive shadow-2xl shadow-destructive/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black text-destructive">
                        <AlertTriangle className="h-6 w-6" />
                        Destruição Permanente
                    </DialogTitle>
                    <DialogDescription className="text-foreground/80 mt-2 font-medium">
                        Você está prestes a excluir permanentemente a empresa <strong className="text-foreground">{org.name}</strong>.
                        Isso apagará <strong>TODOS</strong> os leads, conversas, integrações e arquivos associados. 
                        Essa ação <strong>NÃO</strong> pode ser desfeita.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 bg-destructive/5 -mx-6 px-6 border-y border-destructive/20">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-destructive tracking-widest">
                            Digite "{org.slug}" para confirmar
                        </Label>
                        <Input 
                            value={confirmSlug}
                            onChange={e => setConfirmSlug(e.target.value)}
                            placeholder={org.slug}
                            className="font-mono border-destructive/30 focus-visible:ring-destructive bg-background"
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="border-border/50">
                        Cancelar
                    </Button>
                    <Button 
                        type="button" 
                        variant="destructive"
                        disabled={!isMatch || loading} 
                        onClick={handleDelete}
                        className="gap-2 font-black shadow-lg"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        DESTRUIR EMPRESA
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
