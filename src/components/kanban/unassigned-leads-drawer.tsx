'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { Loader2, Users, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { KanbanFunnel, KanbanStage } from '@/lib/types';

export function UnassignedLeadsDrawer({ funnels }: { funnels: KanbanFunnel[] }) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedFunnel, setSelectedFunnel] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const activeFunnel = funnels.find(f => f.id === selectedFunnel);
  const funnelStages = activeFunnel?.stages as KanbanStage[] || [];

  useEffect(() => {
    if (open) {
      loadUnassigned();
    }
  }, [open]);

  const loadUnassigned = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/kanbans/unassigned-leads');
      if (!res.ok) throw new Error('Falha ao carregar contatos');
      const data = await res.json();
      setContacts(data);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedContact || !selectedFunnel || !selectedStage) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/v1/kanbans/${selectedFunnel}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContact,
          stageId: selectedStage,
        }),
      });

      if (!res.ok) throw new Error('Erro ao atribuir lead');
      
      notify.success('Sucesso', 'Lead adicionado ao funil!');
      setSelectedContact(null);
      await loadUnassigned(); // Reload list
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <Users className="mr-2 h-4 w-4" />
          Leads Sem Funil
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[85vh]">
        <div className="mx-auto w-full max-w-4xl h-full flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Contatos sem Funil</DrawerTitle>
            <DrawerDescription>
              Selecione um contato que não está em nenhum pipeline para atribuí-lo a um funil.
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="flex-1 overflow-y-auto p-4 flex gap-6">
            {/* Lista de Contatos */}
            <div className="w-1/2 border rounded-lg flex flex-col">
              <div className="p-3 border-b bg-muted/20 font-medium flex justify-between items-center">
                <span>Contatos Disponíveis</span>
                <span className="text-xs bg-muted px-2 py-1 rounded-full">{contacts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Todos os seus contatos já estão em funis!</div>
                ) : (
                  contacts.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setSelectedContact(c.id)}
                      className={`p-3 rounded-md cursor-pointer border transition-colors ${selectedContact === c.id ? 'bg-primary/10 border-primary' : 'bg-card hover:bg-muted/50 border-transparent'}`}
                    >
                      <div className="font-medium text-sm">{c.name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Painel de Atribuição */}
            <div className="w-1/2 flex flex-col gap-4">
              <div className="p-4 border rounded-lg bg-card space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-primary" /> Atribuir ao Funil
                </h3>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium">Selecione o Funil</label>
                  <Select value={selectedFunnel || ''} onValueChange={(val) => { setSelectedFunnel(val); setSelectedStage(null); }}>
                    <SelectTrigger><SelectValue placeholder="Escolha um funil..." /></SelectTrigger>
                    <SelectContent>
                      {funnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium">Selecione a Etapa</label>
                  <Select value={selectedStage || ''} onValueChange={setSelectedStage} disabled={!selectedFunnel}>
                    <SelectTrigger><SelectValue placeholder="Escolha a etapa..." /></SelectTrigger>
                    <SelectContent>
                      {funnelStages.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4">
                  <Button 
                    className="w-full" 
                    onClick={handleAssign}
                    disabled={!selectedContact || !selectedFunnel || !selectedStage || assigning}
                  >
                    {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Atribuir Lead Selecionado
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DrawerFooter className="border-t pt-2">
            <DrawerClose asChild>
              <Button variant="outline">Fechar</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
