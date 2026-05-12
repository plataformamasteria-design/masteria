import React from 'react';

interface MessageDaySeparatorProps {
  date: string;
}

export const MessageDaySeparator: React.FC<MessageDaySeparatorProps> = ({ date }) => {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-muted px-3 py-1 rounded-full">
        <span className="text-xs text-muted-foreground font-medium">{date}</span>
      </div>
    </div>
  );
};
