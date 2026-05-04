
'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, MessageSquareText, ArrowRight, FileText, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateCampaignDialogProps {
  children: React.ReactNode;
}

export function CreateCampaignDialog({ children }: CreateCampaignDialogProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [showWhatsAppInfo, setShowWhatsAppInfo] = useState(false);
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsOpen(false);
    setShowWhatsAppInfo(false);
  };

  const handleWhatsAppClick = () => {
    setShowWhatsAppInfo(true);
  };

  const handleBack = () => {
    setShowWhatsAppInfo(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setShowWhatsAppInfo(false);
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {showWhatsAppInfo ? 'Campanha WhatsApp (Meta API)' : 'Criar Nova Campanha'}
          </DialogTitle>
          <DialogDescription>
            {showWhatsAppInfo 
              ? 'Para campanhas via Meta API, você precisa de um template aprovado.'
              : 'Escolha o canal pelo qual você deseja enviar a sua campanha.'
            }
          </DialogDescription>
        </DialogHeader>
        
        {!showWhatsAppInfo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <Button variant="outline" className="w-full h-24 flex-col gap-2" onClick={handleWhatsAppClick}>
              <MessageSquareText className="h-8 w-8 text-green-500"/>
              <span className="text-base">WhatsApp</span>
              <span className="text-xs text-muted-foreground">Meta Cloud API</span>
            </Button>
            <Button variant="outline" className="w-full h-24 flex-col gap-2" onClick={() => handleNavigate('/sms')}>
              <MessageCircle className="h-8 w-8 text-blue-500"/>
              <span className="text-base">SMS</span>
              <span className="text-xs text-muted-foreground">Envio direto</span>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                A Meta exige que mensagens em massa sejam enviadas usando <strong>templates pré-aprovados</strong>. 
                Você precisa criar um template primeiro.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <Button 
                className="w-full justify-between" 
                onClick={() => handleNavigate('/templates')}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Ir para Templates</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              <p className="text-xs text-muted-foreground text-center">
                Após criar o template, você poderá usá-lo em suas campanhas.
              </p>
            </div>
            
            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Voltar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleNavigate('/campaigns-baileys')}>
                Usar WhatsMeow (sem template)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
