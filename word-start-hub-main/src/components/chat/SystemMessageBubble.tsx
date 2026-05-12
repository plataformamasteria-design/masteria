import React from 'react';
import { Message } from '@/types/message';
import { format } from 'date-fns';
import { Info } from 'lucide-react';

interface SystemMessageBubbleProps {
  message: Message;
}

export const SystemMessageBubble: React.FC<SystemMessageBubbleProps> = ({ message }) => {
  const time = format(new Date(message.created_at), 'HH:mm');

  return (
    <div className="flex justify-center my-4 px-2">
      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 justify-center">
          <Info className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
            {message.content}
          </p>
        </div>
        <div className="flex justify-center mt-1">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {time}
          </span>
        </div>
      </div>
    </div>
  );
};
