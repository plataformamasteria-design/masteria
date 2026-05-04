'use client';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, CheckCircle, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EmailEvent {
  id: string;
  email: string;
  eventType: string;
  timestamp: string;
}

export default function EmailTrackingPage() {
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/v1/admin/email-events');
        if (!response.ok) throw new Error('Falha ao carregar eventos de email');
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const getEventIcon = (type: string) => {
    if (type === 'delivered') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (type === 'bounce') return <XCircle className="h-4 w-4 text-red-600" />;
    return <Mail className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Email Tracking" description="Rastreamento de eventos de email do Resend" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Total de Eventos: {events.length}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Tipo de Evento</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : events.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento de email encontrado</TableCell></TableRow>
                ) : (
                  events.map(event => (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">{event.email}</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800">{event.eventType}</Badge></TableCell>
                      <TableCell className="text-sm">{new Date(event.timestamp).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-center">{getEventIcon(event.eventType)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`px-2 py-1 rounded text-sm font-medium ${className || 'bg-gray-200'}`}>{children}</span>;
}
