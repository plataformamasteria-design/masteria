
'use client';

import { InboxView } from '@/components/atendimentos/inbox-view';
import { useSearchParams } from 'next/navigation';

// Types
import { Conversation } from '@/lib/types';

interface AtendimentosClientProps {
  initialConversations: Conversation[];
  initialTemplates: any[];
}

export function AtendimentosClient({ initialConversations, initialTemplates }: AtendimentosClientProps) {
  const searchParams = useSearchParams();
  const conversationId = searchParams.get('conversationId') || undefined;

  return (
    <div className="flex flex-col h-full min-h-0 pb-20 md:pb-0 w-full max-w-full overflow-hidden">
      <div className="flex-1 min-h-0">
        <InboxView
          preselectedConversationId={conversationId}
          initialConversations={initialConversations}
          initialTemplates={initialTemplates}
        />
      </div>
    </div>
  );
}
