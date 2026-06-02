'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { CreateWhatsappCampaignDialog } from './create-whatsapp-campaign-dialog';
import type { Connection, Template } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface Props {
  children?: React.ReactNode;
}

export function CreateWhatsappCampaignWrapper({ children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch connections
      const connResponse = await fetch('/api/v1/connections');
      if (!connResponse.ok) throw new Error('Falha ao carregar conexões');
      const connData = await connResponse.json();
      setConnections(Array.isArray(connData) ? connData : []);

      // Fetch templates
      const tempResponse = await fetch('/api/v1/message-templates');
      if (!tempResponse.ok) throw new Error('Falha ao carregar templates');
      const tempData = await tempResponse.json();
      
      // Convert MessageTemplate to Template
      const convertedTemplates = (Array.isArray(tempData) ? tempData : []).map(t => {
        const bodyComponent = Array.isArray(t.components) 
          ? t.components.find((c: any) => c.type === 'BODY')
          : null;
        
        const headerComponent = Array.isArray(t.components)
          ? t.components.find((c: any) => c.type === 'HEADER')
          : null;
          
        const matchingConnection = connData.find((c: any) => c.id === t.connectionId);
        
        return {
          ...t,
          connection: matchingConnection,
          body: bodyComponent?.text || '',
          headerType: (headerComponent?.format as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null) || null,
        } as Template;
      });
      
      setTemplates(convertedTemplates);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as dependências da campanha.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleOpen = () => {
    setIsOpen(true);
    fetchData();
  };

  return (
    <>
      {children ? (
        React.cloneElement(children as React.ReactElement<any>, {
          onClick: (e: React.MouseEvent) => {
            handleOpen();
            (children as React.ReactElement<any>).props.onClick?.(e);
          },
        })
      ) : (
        <Button onClick={handleOpen}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Criar Campanha API
        </Button>
      )}

      <CreateWhatsappCampaignDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        connections={connections}
        templates={templates}
        isLoading={loading}
        onBack={() => setIsOpen(false)}
      />
    </>
  );
}
