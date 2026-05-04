'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Phone, CheckCircle, Loader2, RefreshCw, Plus } from 'lucide-react';

interface PhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  voiceEnabled: boolean;
  smsEnabled: boolean;
  registeredInRetell: boolean;
}

export function PhoneNumbersManager() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/voice/phone-numbers');
      if (response.ok) {
        const data = await response.json();
        setPhoneNumbers(data.data || []);
      } else {
        throw new Error('Falha ao buscar números');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  const registerInRetell = async (phoneNumber: string) => {
    setRegistering(phoneNumber);
    try {
      const response = await fetch('/api/v1/voice/phone-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Falha ao registrar');
      }

      toast({
        title: 'Sucesso!',
        description: data.message,
      });
      
      fetchNumbers();
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao registrar número',
        variant: 'destructive',
      });
    } finally {
      setRegistering(null);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5" />
            Números de Telefone
          </CardTitle>
          <CardDescription>
            Gerencie os números Twilio disponíveis para chamadas de voz
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNumbers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum número Twilio encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {phoneNumbers.map((phone) => (
              <div
                key={phone.phoneNumber}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${phone.registeredInRetell ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Phone className={`h-4 w-4 ${phone.registeredInRetell ? 'text-green-600' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="font-medium font-mono">{phone.phoneNumber}</p>
                    <p className="text-sm text-muted-foreground">{phone.friendlyName}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {phone.voiceEnabled && (
                      <Badge variant="outline" className="text-xs">Voz</Badge>
                    )}
                    {phone.smsEnabled && (
                      <Badge variant="outline" className="text-xs">SMS</Badge>
                    )}
                  </div>
                  
                  {phone.registeredInRetell ? (
                    <Badge className="bg-green-500 text-white">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Retell
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => registerInRetell(phone.phoneNumber)}
                      disabled={registering === phone.phoneNumber}
                    >
                      {registering === phone.phoneNumber ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Registrar no Retell
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Informações</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Números com badge <span className="text-green-600 font-medium">Retell</span> podem receber e transferir chamadas de voz AI</li>
            <li>Para registrar novos números, é necessário ter um cartão configurado no Retell</li>
            <li>Todos os números podem ser usados para fazer chamadas de saída</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
