'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Building2 } from 'lucide-react';
import { createOrganization } from '@/app/actions/superadmin-actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface CreateOrganizationDialogProps {
    open: boolean;
    onClose: () => void;
}

export function CreateOrganizationDialog({ open, onClose }: CreateOrganizationDialogProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        maxContacts: 500,
        maxMessages: 1000
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return toast.error('O nome da empresa é obrigatório.');

        setLoading(true);
        const res = await createOrganization({
            name: formData.name,
            slug: formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            maxContacts: formData.maxContacts,
            maxMessages: formData.maxMessages
        });

        if (res.success) {
            toast.success('Empresa criada com sucesso!');
            router.refresh();
            onClose();
            setFormData({ name: '', slug: '', maxContacts: 500, maxMessages: 1000 });
        } else {
            toast.error('Erro ao criar empresa: ' + res.error);
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-md bg-background border-border shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                        <Building2 className="h-5 w-5 text-primary" />
                        Nova Empresa (Tenant)
                    </DialogTitle>
                    <DialogDescription>
                        Crie uma nova organização na infraestrutura MasterIA.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Nome da Empresa *</Label>
                        <Input 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            placeholder="Ex: Empresa Corp LTDA"
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Slug Único (Opcional)</Label>
                        <Input 
                            value={formData.slug}
                            onChange={e => setFormData({...formData, slug: e.target.value})}
                            placeholder="ex: empresa-corp"
                            className="font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">Se vazio, será gerado automaticamente a partir do nome.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Max Leads</Label>
                            <Input 
                                type="number"
                                value={formData.maxContacts}
                                onChange={e => setFormData({...formData, maxContacts: Number(e.target.value)})}
                                className="font-mono"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Max Msgs/Mês</Label>
                            <Input 
                                type="number"
                                value={formData.maxMessages}
                                onChange={e => setFormData({...formData, maxMessages: Number(e.target.value)})}
                                className="font-mono"
                            />
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-2 font-bold shadow-lg">
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Criar Tenant
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
