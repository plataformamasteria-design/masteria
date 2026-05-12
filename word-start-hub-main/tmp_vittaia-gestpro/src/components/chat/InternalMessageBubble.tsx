import React, { useEffect, useState } from 'react';
import { Message } from '@/types/message';
import { format } from 'date-fns';
import { Lock } from 'lucide-react';
import { cn, formatMarkdownText } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface InternalMessageBubbleProps {
  message: Message;
}

export const InternalMessageBubble: React.FC<InternalMessageBubbleProps> = ({ message }) => {
  const [agentName, setAgentName] = useState<string>('Agente');
  const time = format(new Date(message.created_at), 'HH:mm');

  useEffect(() => {
    const fetchAgentName = async () => {
      if (!message.sent_by) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', message.sent_by)
        .single();
      
      if (profile?.full_name) {
        setAgentName(profile.full_name);
      }
    };

    fetchAgentName();
  }, [message.sent_by]);

  return (
    <div className="flex mb-1 px-2 justify-start">
      <div className="max-w-[65%] rounded-lg px-3 py-2 shadow-sm bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-200">
            {agentName}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words text-slate-900 dark:text-slate-100">
          {formatMarkdownText(message.content || '')}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[11px] text-amber-500 dark:text-amber-400">
            {time}
          </span>
        </div>
      </div>
    </div>
  );
};
