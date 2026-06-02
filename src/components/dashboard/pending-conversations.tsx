
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import useSWR from 'swr';
import type { Conversation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { RelativeTime } from '../ui/relative-time';


export function PendingConversations() {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);

  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Falha ao buscar conversas.');
    const responseData = await response.json();
    return responseData.data || responseData;
  };

  const { data, error, isLoading: loading } = useSWR<Conversation[]>('/api/v1/conversations', fetcher, {
    dedupingInterval: 30000,
    revalidateOnFocus: false,
    onError: (err) => notify.error('Erro', err.message)
  });

  const conversations = data ? data.filter(c => c.status === 'NEW').slice(0, 4) : [];


  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <CardTitle className="text-lg">Atendimentos Pendentes</CardTitle>
        <CardDescription>Conversas aguardando uma primeira resposta.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
             <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length > 0 ? conversations.map(conv => (
            <div key={conv.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={conv.contactAvatar || ''} alt={conv.contactName} data-ai-hint="avatar user"/>
                  <AvatarFallback>{conv.contactName.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-sm">
                    <Link href={`/contacts/${conv.contactId}`} target="_blank" className="hover:underline">
                      {conv.contactName}
                    </Link>
                  </p>
                  <RelativeTime date={conv.lastMessageAt} />
                </div>
              </div>
              <Link href={`/atendimentos?conversationId=${conv.id}`} passHref>
                <Button variant="outline" size="sm">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )) : (
             <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendimento pendente.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
