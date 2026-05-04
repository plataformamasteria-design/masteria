import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronDown } from "lucide-react";

export interface DateRange {
    start: string;
    end: string;
    preset: string;
}

const PRESETS = [
    { value: "today", label: "Hoje" },
    { value: "yesterday", label: "Ontem" },
    { value: "this_week", label: "Esta Semana" },
    { value: "this_month", label: "Este Mês" },
    { value: "last_7d", label: "Últimos 7 dias" },
    { value: "last_30d", label: "Últimos 30 dias" },
    { value: "last_90d", label: "Últimos 90 dias" },
    { value: "all_time", label: "Todo Período" },
] as const;

function getDefaultRange(): DateRange {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        start: monthStart.toISOString().split("T")[0],
        end: now.toISOString().split("T")[0],
        preset: "this_month",
    };
}

function getPresetLabel(preset: string): string {
    return PRESETS.find((p) => p.value === preset)?.label || "Personalizado";
}

export function useDateRange() {
    const [dateRange, setDateRange] = useState<DateRange>(getDefaultRange);
    return { dateRange, setDateRange };
}

export function DateRangePicker({
    value,
    onChange,
}: {
    value: DateRange;
    onChange: (range: DateRange) => void;
}) {
    const [open, setOpen] = useState(false);
    const [customStart, setCustomStart] = useState(value.start);
    const [customEnd, setCustomEnd] = useState(value.end);

    const selectPreset = (preset: string) => {
        const now = new Date();
        const yyyy = (d: Date) => d.toISOString().split("T")[0];
        let start = value.start;
        let end = yyyy(now);

        switch (preset) {
            case "today": start = end = yyyy(now); break;
            case "yesterday": { const y = new Date(now); y.setDate(y.getDate() - 1); start = end = yyyy(y); break; }
            case "this_week": { const day = now.getDay(); const diff = day === 0 ? 6 : day - 1; const ws = new Date(now); ws.setDate(now.getDate() - diff); start = yyyy(ws); break; }
            case "this_month": { start = yyyy(new Date(now.getFullYear(), now.getMonth(), 1)); break; }
            case "last_7d": { const d = new Date(now); d.setDate(d.getDate() - 7); start = yyyy(d); break; }
            case "last_30d": { const d = new Date(now); d.setDate(d.getDate() - 30); start = yyyy(d); break; }
            case "last_90d": { const d = new Date(now); d.setDate(d.getDate() - 90); start = yyyy(d); break; }
            case "all_time": { start = "2020-01-01"; break; }
        }
        onChange({ start, end, preset });
        setOpen(false);
    };

    const applyCustom = () => {
        onChange({ start: customStart, end: customEnd, preset: "custom" });
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {getPresetLabel(value.preset)}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 space-y-1">
                    {PRESETS.map((p) => (
                        <button
                            key={p.value}
                            onClick={() => selectPreset(p.value)}
                            className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${value.preset === p.value
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : "hover:bg-muted text-foreground"
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="border-t p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Personalizado</p>
                    <div className="flex gap-2">
                        <Input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="h-7 text-xs"
                        />
                        <Input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="h-7 text-xs"
                        />
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={applyCustom}>
                        Aplicar
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
