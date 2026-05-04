

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MultiSelectCreatable } from '../ui/multi-select-creatable';
import Image from 'next/image';

interface AddContactDialogProps {
    children: React.ReactNode;
    onSaveSuccess?: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const ddiMap: { [key: string]: string } = {
    '55': 'BR',
    '1': 'US',
    '44': 'GB',
    '351': 'PT',
    '49': 'DE',
    '33': 'FR',
    '39': 'IT',
    '81': 'JP',
};

export function AddContactDialog({ children, onSaveSuccess, open, onOpenChange }: AddContactDialogProps) {
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);
    const [internalOpen, setInternalOpen] = useState(false);
    const [selectedDDI, setSelectedDDI] = useState('55');

    const isOpen = open !== undefined ? open : internalOpen;
    const setIsOpen = onOpenChange || setInternalOpen;
    const [phoneInput, setPhoneInput] = useState('');

    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedListIds, setSelectedListIds] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) {
            // Reset state when closing
            setSelectedTagIds([]);
            setSelectedListIds([]);
            setPhoneInput('');
        }
    }, [isOpen]);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        setPhoneInput(value);
        for (const ddi in ddiMap) {
            if (value.startsWith(ddi)) {
                setSelectedDDI(ddi);
                return;
            }
        }
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const phone = `+${selectedDDI}${phoneInput}`;

        // Validação client-side dos campos obrigatórios
        const name = formData.get('contact-name');
        if (!name || typeof name !== 'string' || name.trim() === '') {
            notify.error("Erro de validação", "Nome é obrigatório");
            return;
        }

        if (selectedTagIds.length === 0) {
            notify.error("Erro de validação", "Selecione pelo menos uma tag");
            return;
        }

        if (selectedListIds.length === 0) {
            notify.error("Erro de validação", "Selecione pelo menos uma lista");
            return;
        }

        const getFormValue = (key: string) => {
            const value = formData.get(key);
            return value && typeof value === 'string' && value.trim() !== '' ? value : undefined;
        }

        const data = {
            name: getFormValue('contact-name'),
            phone: phone,
            email: getFormValue('contact-email'),
            avatarUrl: getFormValue('avatar-url'),
            addressStreet: getFormValue('address-street'),
            addressNumber: getFormValue('address-number'),
            addressComplement: getFormValue('address-complement'),
            addressDistrict: getFormValue('address-district'),
            addressCity: getFormValue('address-city'),
            addressState: getFormValue('address-state'),
            addressZipCode: getFormValue('address-zip'),
            tagIds: selectedTagIds,
            listIds: selectedListIds,
        };

        const response = await fetch('/api/v1/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (response.ok) {
            notify.success("Contato Criado!", "O novo contato foi adicionado com sucesso.");
            setIsOpen(false);
            if (onSaveSuccess) {
                onSaveSuccess();
            }
        } else if (response.status === 409) {
            notify.info("Contato Duplicado", "Este contato já existe na sua base de dados.");
        } else {
            const error = await response.json();
            notify.error("Erro ao criar contato", error.error || 'Ocorreu um erro.');
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Adicionar Novo Contato</DialogTitle>
                    <DialogDescription>
                        Preencha as informações detalhadas do novo contato.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSave}>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto -mx-6 px-6 py-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src="" alt="Avatar" data-ai-hint="avatar user" />
                                <AvatarFallback>??</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                                <Label htmlFor="avatar-url">URL do Avatar</Label>
                                <Input name="avatar-url" id="avatar-url" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact-name">Nome Completo</Label>
                                <Input name="contact-name" id="contact-name" placeholder="Nome do Contato" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contact-phone">Telefone</Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Image src={`https://flagsapi.com/${ddiMap[selectedDDI] || 'BR'}/flat/16.png`} alt="Bandeira" width={16} height={12} className="h-auto w-auto" />
                                        <span className="ml-2 text-sm text-muted-foreground">+{selectedDDI}</span>
                                    </div>
                                    <Input
                                        name="contact-phone"
                                        id="contact-phone"
                                        placeholder="Seu número aqui"
                                        required
                                        className="pl-[80px]"
                                        value={phoneInput}
                                        onChange={handlePhoneChange}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="contact-email">Email</Label>
                                <Input name="contact-email" id="contact-email" type="email" placeholder="email@exemplo.com" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <Label>Endereço</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input name="address-street" placeholder="Rua / Avenida" />
                                <Input name="address-number" placeholder="Número" />
                                <Input name="address-complement" placeholder="Complemento" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input name="address-district" placeholder="Bairro" />
                                <Input name="address-city" placeholder="Cidade" />
                                <Input name="address-state" placeholder="Estado" />
                            </div>
                            <Input name="address-zip" placeholder="CEP" className="md:w-1/3" />
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <Label>Segmentação</Label>
                            <div className="space-y-2">
                                <Label htmlFor="tags"><span className="text-red-500">*</span> Tags</Label>
                                <MultiSelectCreatable
                                    selected={selectedTagIds}
                                    onChange={setSelectedTagIds}
                                    placeholder="Selecione ou crie tags..."
                                    createEndpoint="tags"
                                    createResourceType="tag"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lists"><span className="text-red-500">*</span> Listas</Label>
                                <MultiSelectCreatable
                                    selected={selectedListIds}
                                    onChange={setSelectedListIds}
                                    placeholder="Selecione ou crie listas..."
                                    createEndpoint='lists'
                                    createResourceType='list'
                                />
                            </div>
                        </div>

                    </div>
                    <DialogFooter className="pt-6">
                        <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">Salvar Contato</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
