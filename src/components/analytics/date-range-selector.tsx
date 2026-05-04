'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeSelectorProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const presets = [
    {
      label: 'Hoje',
      getValue: () => {
        const today = new Date();
        return { from: today, to: today };
      },
    },
    {
      label: 'Últimos 7 dias',
      getValue: () => {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return { from: sevenDaysAgo, to: today };
      },
    },
    {
      label: 'Últimos 30 dias',
      getValue: () => {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return { from: thirtyDaysAgo, to: today };
      },
    },
    {
      label: 'Este mês',
      getValue: () => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: firstDay, to: today };
      },
    },
  ];

  const handlePresetClick = (preset: { label: string; getValue: () => DateRange }) => {
    onChange(preset.getValue());
    setIsOpen(false);
  };

  return (
    <div className={cn('flex flex-col sm:flex-row gap-2', className)}>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handlePresetClick(preset)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full sm:w-[280px] justify-start text-left font-normal',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, 'dd/MM/yyyy')} - {format(value.to, 'dd/MM/yyyy')}
                </>
              ) : (
                format(value.from, 'dd/MM/yyyy')
              )
            ) : (
              <span>Selecionar período</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
