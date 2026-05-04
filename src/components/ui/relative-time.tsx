
// src/components/ui/relative-time.tsx
'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const RelativeTime = ({ date }: { date: string | Date | null }) => {
    const [formattedDate, setFormattedDate] = useState<string | null>(null);

    useEffect(() => {
        if (date) {
            try {
                const parsedDate = new Date(date);
                if (!isNaN(parsedDate.getTime())) {
                    const now = new Date();
                    const diffMs = now.getTime() - parsedDate.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);

                    let timeStr = '';
                    if (diffMins < 1) timeStr = 'agora';
                    else if (diffMins < 60) timeStr = `${diffMins} min`;
                    else if (diffHours < 24) timeStr = `${diffHours} h`;
                    else if (diffDays === 1) timeStr = 'ontem';
                    else if (diffDays < 7) timeStr = `${diffDays} d`;
                    else {
                        const day = parsedDate.getDate().toString().padStart(2, '0');
                        const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
                        const year = parsedDate.getFullYear().toString().slice(-2);
                        timeStr = `${day}/${month}/${year}`;
                    }
                    
                    setFormattedDate(timeStr);
                } else {
                    setFormattedDate('Data inválida');
                }
            } catch (error) {
                console.error("Invalid date passed to RelativeTime:", date);
                setFormattedDate('Data inválida');
            }
        }
    }, [date]);

    // Render nothing on the server and on initial client render
    if (!formattedDate) {
        return null; // Avoids hydration mismatch by not rendering anything initially.
    }

    return (
        <span className="text-xs text-muted-foreground truncate max-w-40">
            {formattedDate}
        </span>
    );
};
