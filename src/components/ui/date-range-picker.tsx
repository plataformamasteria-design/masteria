
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps extends React.ComponentProps<'div'> {
  onDateChange?: (date: DateRange | undefined) => void;
  initialDate?: DateRange;
}

export function DateRangePicker({
  className,
  onDateChange,
  initialDate,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [isClient, setIsClient] = React.useState(false);

  // CORREÇÃO: Usar useEffect para sincronizar a data inicial apenas no cliente.
  // Isso evita que a data seja formatada no servidor e cause um mismatch.
  React.useEffect(() => {
    setIsClient(true);
    setDate(initialDate);
  }, [initialDate]);

  const handleSelectDate = (selectedDate: DateRange | undefined) => {
    setDate(selectedDate);
    if (onDateChange) {
      onDateChange(selectedDate);
    }
  };

  const renderDateLabel = () => {
    if (!isClient || !date?.from) {
      return <span>Selecione um período</span>;
    }
    if (date.to) {
      return (
        <>
          {format(date.from, 'LLL dd, y', { locale: ptBR })} -{' '}
          {format(date.to, 'LLL dd, y', { locale: ptBR })}
        </>
      );
    }
    return format(date.from, 'LLL dd, y', { locale: ptBR });
  };

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {renderDateLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleSelectDate}
            numberOfMonths={2}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
