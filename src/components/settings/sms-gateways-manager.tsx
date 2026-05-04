'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Dialog,
  DialogContent,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { MoreHorizontal, PlusCircle, Trash2, Edit, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SmsGateway } from '@/lib/types';
import { Switch } from '../ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
// import { CreateSmsCampaignDialog } from '../campaigns/create-sms-campaign-dialog';

const providerConfig = {
    witi: {
        label: 'SMS Flash Advanced',
        credentials: [{ name: 'token', label: 'Token', type: 'password' }]
    },
    'seven.io': {
        label: 'seven.io',
        credentials: [{ name: 'apiKey', label: 'API Key', type: 'password'}]
    },
    mkom: {
        label: 'MKOM (MKSMS)',
        credentials: [
            { name: 'token', label: 'Token JWT', type: 'password' },
            { name: 'cost_centre_id', label: 'Centro de Custo (ID)', type: 'text' }
        ]
    }
} as const;

type Provider = keyof typeof providerConfig;

const CredentialInputs = ({ provider, gateway, validationErrors }: { provider: Provider | null, gateway: SmsGateway | null, validationErrors: Record<string, string> }): JSX.Element | null => {
    if (!provider) return null;
    const config = providerConfig[provider as Provider];

    return (
        <>
            {config.credentials.map(field => {
                const isCostCentreForMkom = provider === 'mkom' && field.name === 'cost_centre_id';
                const isTokenField = field.name === 'token' || field.name === 'apiKey';
                const isRequired = isCostCentreForMkom || (!gateway && isTokenField);
                const hasError = validationErrors[field.name];
                
                return (
                    <div key={field.name} className="space-y-2">
                        <Label htmlFor={field.name}>
                            {field.label}
                            {isRequired && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <Input 
                          id={field.name} 
                          name={field.name} 
                          type={field.type} 
                          placeholder={gateway && isTokenField ? 'Deixe em branco para manter a atual' : ''}
                          defaultValue={''}
                          className={hasError ? 'border-destructive' : ''}
                        />
                        {hasError && (
                            <p className="text-sm text-destructive">{hasError}</p>
                        )}
                    </div>
                );
            })}
        </>
    );
}

export function SmsGatewaysManager(): JSX.Element {
    const [gateways, setGateways] = useState<SmsGateway[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGateway, setEditingGateway] = useState<SmsGateway | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isOpen, setIsOpen] = useState(true);
    const { toast } = useToast();
    const notify = useMemo(() => createToastNotifier(toast), [toast]);

    const fetchGateways = async (): Promise<void> => {
        try {
            setLoading(true);
            const response = await fetch('/api/v1/sms-gateways');
            if (!response.ok) {
                throw new Error('Falha ao carregar gateways de SMS.');
            }
            const data = await response.json();
            setGateways(data);
        } catch (error) {
            notify.error('Erro', (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGateways();
    }, [notify]);

    const handleOpenModal = (gateway?: SmsGateway): void => {
        setEditingGateway(gateway || null);
        setSelectedProvider((gateway?.provider as Provider) || null);
        setValidationErrors({});
        setIsModalOpen(true);
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setValidationErrors({});
        
        const formData = new FormData(event.currentTarget);
        const name = formData.get('name') as string;
        
        const isEditing = !!editingGateway;
        const provider = editingGateway?.provider || selectedProvider;
        if (!provider) return;
        
        const credentials: Record<string, string> = {};
        let credentialsProvided = false;
        const errors: Record<string, string> = {};
        
        providerConfig[provider as Provider].credentials.forEach(field => {
            const value = formData.get(field.name) as string;
            if (value) {
                credentials[field.name] = value;
                credentialsProvided = true;
            }
        });
        
        if (provider === 'mkom') {
            const costCentreId = formData.get('cost_centre_id') as string;
            if (!costCentreId || costCentreId.trim() === '' || costCentreId === '0') {
                errors['cost_centre_id'] = 'Centro de Custo é obrigatório para o gateway MKOM.';
            }
        }
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

        const payload: Partial<SmsGateway> & { provider?: string } = { name };

        if (isEditing) {
            if (credentialsProvided) {
                 payload.credentials = credentials;
            }
        } else {
             payload.provider = provider;
             payload.credentials = credentials;
        }

        const url = isEditing ? `/api/v1/sms-gateways/${editingGateway.id}` : '/api/v1/sms-gateways';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao salvar o gateway.');
            }

            notify.success(`Gateway ${isEditing ? 'Atualizado' : 'Criado'}!`, 'A configuração do gateway foi salva.');
            setIsModalOpen(false);
            await fetchGateways();

        } catch (error) {
            notify.error('Erro', (error as Error).message);
        }
    }

    const handleDelete = async (gatewayId: string): Promise<void> => {
        try {
            const response = await fetch(`/api/v1/sms-gateways/${gatewayId}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha ao excluir o gateway.');
            }
            setGateways(prev => prev.filter(gw => gw.id !== gatewayId));
            notify.success('Gateway Excluído!', 'O gateway foi removido com sucesso.');
        } catch (error) {
             notify.error('Erro ao Excluir', (error as Error).message);
        }
    }

    const handleToggleActive = async (gatewayId: string, isActive: boolean): Promise<void> => {
        const originalGateways = [...gateways];
        setGateways(prev => prev.map(gw => gw.id === gatewayId ? { ...gw, isActive } : gw));

        try {
            const response = await fetch(`/api/v1/sms-gateways/${gatewayId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive })
            });

            if (!response.ok) throw new Error("Falha ao atualizar o status do gateway.");

        } catch(error) {
            notify.error('Erro', (error as Error).message);
            setGateways(originalGateways);
        }
    }
    
    return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 hover:bg-transparent">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="sr-only">Toggle</span>
                </Button>
            </CollapsibleTrigger>
            <div>
                <CardTitle>Gateways de SMS</CardTitle>
                <CardDescription>
                Configure múltiplos provedores para o envio de campanhas de SMS.
                </CardDescription>
            </div>
          </div>
          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleOpenModal()}>
                <PlusCircle className="mr-2" />
                Adicionar Gateway
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
            <CardContent>
            <div className="w-full border rounded-lg relative">
                <div className="w-full overflow-auto">
                    <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Nome da Configuração</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        </TableCell>
                    </TableRow>
                    ) : gateways.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                        Nenhum gateway configurado.
                        </TableCell>
                    </TableRow>
                    ) : (
                    gateways.map((gw) => (
                        <TableRow key={gw.id}>
                            <TableCell className="font-medium">{gw.name}</TableCell>
                            <TableCell className="uppercase">{providerConfig[gw.provider as Provider]?.label || gw.provider}</TableCell>
                            <TableCell>
                                <Switch
                                    checked={gw.isActive}
                                    onCheckedChange={(checked) => handleToggleActive(gw.id, checked)}
                                    aria-label="Ativar gateway"
                                />
                            </TableCell>
                            <TableCell className="text-right">
                            <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleOpenModal(gw)}>
                                            <Edit className="mr-2 h-4 w-4"/>
                                            Editar
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4"/>Excluir
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                    <AlertDialogDescription>Deseja excluir o gateway &quot;{gw.name}&quot;? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(gw.id)}>Sim, Excluir</AlertDialogAction>
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
            </CardContent>
        </CollapsibleContent>
      </Card>
      </Collapsible>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingGateway ? 'Editar Gateway' : 'Adicionar Novo Gateway'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="provider">Provedor</Label>
                        <Select
                            value={editingGateway?.provider || selectedProvider || ''}
                            onValueChange={(val) => setSelectedProvider(val as Provider)}
                            disabled={!!editingGateway}
                        >
                            <SelectTrigger id="provider">
                                <SelectValue placeholder="Selecione um provedor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="witi">SMS Flash Advanced</SelectItem>
                                <SelectItem value="seven.io">seven.io</SelectItem>
                                <SelectItem value="mkom">MKOM (MKSMS)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(selectedProvider || editingGateway) && (
                        <>
                        <div className="space-y-2">
                            <Label htmlFor="gateway-name">Nome da Configuração</Label>
                            <Input id="gateway-name" name="name" placeholder="Ex: Conta Principal SMS Flash Advanced" defaultValue={editingGateway?.name} required />
                        </div>
                        <CredentialInputs provider={editingGateway?.provider as Provider || selectedProvider} gateway={editingGateway} validationErrors={validationErrors} />
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!editingGateway && !selectedProvider}>Salvar</Button>
                </DialogFooter>
                </form>
            </DialogContent>
          </Dialog>
    </>
  );
}
