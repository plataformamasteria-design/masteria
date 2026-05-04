

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Bot, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import type { Connection, Persona } from '@/lib/types';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function RoutingTable() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [routingConfig, setRoutingConfig] = useState<Record<string, string | null>>({});
  const [initialConfig, setInitialConfig] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const isDirty = JSON.stringify(initialConfig) !== JSON.stringify(routingConfig);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [connsRes, personasRes] = await Promise.all([
        fetch('/api/v1/connections'),
        fetch('/api/v1/ia/personas'),
      ]);
        
      if (!connsRes.ok || !personasRes.ok) throw new Error('Falha ao carregar dados de roteamento.');
      
      const connsData = await connsRes.json();
      const personasData = await personasRes.json();
      
      // Em produção, queremos garantir que as conexões Baileys também apareçam
      // Independentemente de estarem "ativas" no banco, se existem devem ser configuráveis
      const activeConnections = connsData.filter((c: Connection) => {
        if (c.connectionType === 'baileys' || c.connectionType === 'apicloud') return true;
        return c.isActive;
      });
      setConnections(activeConnections);
      setPersonas(personasData);

      const initialConfigData: Record<string, string | null> = {};
      activeConnections.forEach((conn: Connection) => {
          initialConfigData[conn.id] = conn.assignedPersonaId || 'manual';
      });
      setRoutingConfig(initialConfigData);
      setInitialConfig(initialConfigData);

    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleRoutingChange = (connectionId: string, responsibleId: string) => {
    setRoutingConfig(prev => ({
      ...prev,
      [connectionId]: responsibleId,
    }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        const updates = Object.entries(routingConfig).filter(
            ([connectionId, personaId]) => initialConfig[connectionId] !== personaId
        );

        const updatePromises = updates.map(([connectionId, personaId]) => {
            const payload = {
                assignedPersonaId: personaId === 'manual' ? null : personaId
            };
            return fetch(`/api/v1/connections/${connectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        });

        const results = await Promise.all(updatePromises);
        const failedUpdates = results.filter(res => !res.ok);

        if (failedUpdates.length > 0) {
            throw new Error(`${failedUpdates.length} regras de roteamento falharam ao salvar.`);
        }
        
        notify.success('Roteamento Salvo!', 'As regras de roteamento foram salvas com sucesso.');
        
        setInitialConfig(routingConfig);

    } catch (error) {
        notify.error('Erro', (error as Error).message);
    } finally {
        setIsSaving(false);
    }
  };
  
  if (loading) {
      return (
        <Card>
            <CardContent className="flex justify-center items-center p-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </CardContent>
        </Card>
      )
  }

  return (
    <div className="space-y-6">
        <Alert>
            <Bot className="h-4 w-4" />
            <AlertTitle>Como funciona o Roteamento?</AlertTitle>
            <AlertDescription>
                Para cada conexão (número de telefone), defina se o primeiro atendimento será feito por um <strong>Agente de IA</strong> ou diretamente por um <strong>Atendente Humano</strong>.
            </AlertDescription>
        </Alert>

      <div className="border rounded-lg w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Conexão</TableHead>
              <TableHead>Responsável pelo Atendimento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">Nenhuma conexão ativa encontrada.</TableCell>
                </TableRow>
            ) : connections.map((connection) => (
              <TableRow key={connection.id}>
                <TableCell className="font-medium">
                  {connection.config_name}
                  <p className="text-xs text-muted-foreground">
                    {connection.phoneNumberId || connection.phone || 'Sem número'}
                  </p>
                </TableCell>
                <TableCell>
                  <Select
                    value={routingConfig[connection.id] || 'manual'}
                    onValueChange={(value) => handleRoutingChange(connection.id, value)}
                  >
                    <SelectTrigger className="w-full md:w-[350px]">
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="manual" className="font-semibold">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" /> Atendimento Manual
                            </div>
                        </SelectItem>
                      {personas.map(persona => (
                        <SelectItem key={persona.id} value={persona.id}>
                           <div className="flex items-center gap-2">
                             <Bot className="h-4 w-4 text-primary"/> Agente: {persona.name}
                           </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end mt-6">
        <Button onClick={handleSaveChanges} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'A Salvar...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
