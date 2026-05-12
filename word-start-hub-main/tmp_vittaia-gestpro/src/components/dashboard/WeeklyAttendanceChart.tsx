import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CalendarDays, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

interface DayData {
  day: string;
  dayName: string;
  count: number;
  fullDate: string;
}

interface WeeklyAttendanceChartProps {
  dateRange?: DateRange;
}

const WeeklyAttendanceChart = ({ dateRange }: WeeklyAttendanceChartProps) => {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<DayData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Stringify dateRange to prevent reference-based infinite loops
  const dateRangeStr = JSON.stringify(dateRange);

  const fetchAttendanceData = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const startDate = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(subDays(new Date(), 6));
      const endDate = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(new Date());

      const days = eachDayOfInterval({ start: startDate, end: endDate });

      const { data: chats, error } = await supabase
        .from("chats")
        .select("created_at")
        .eq("organization_id", currentOrganization.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const countsByDay: Record<string, number> = {};
      chats?.forEach(chat => {
        const dayKey = format(new Date(chat.created_at), "yyyy-MM-dd");
        countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;
      });

      const chartData: DayData[] = days.map(day => {
        const dayKey = format(day, "yyyy-MM-dd");
        const dayOfWeek = getDay(day);
        const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

        return {
          day: format(day, "dd/MM"),
          dayName: dayNames[dayOfWeek],
          count: countsByDay[dayKey] || 0,
          fullDate: format(day, "EEEE, d 'de' MMMM", { locale: ptBR }),
        };
      });

      setData(chartData);
      setTotal(chats?.length || 0);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, dateRangeStr]);

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchAttendanceData();
    }
  }, [currentOrganization?.id, dateRangeStr, fetchAttendanceData]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as DayData;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium capitalize">{item.fullDate}</p>
          <p className="text-2xl font-bold text-primary">{item.count}</p>
          <p className="text-sm text-muted-foreground">atendimentos</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Novos Leads por Período</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48 mx-auto bg-white/5" />
            <Skeleton className="h-[220px] w-full bg-white/5" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-4 mb-8 p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner group">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total no período</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black tracking-tighter gradient-text">{total.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] font-bold text-muted-foreground">atendimentos</span>
                </div>
              </div>
            </div>

            <div className="h-[250px] w-full">
              {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-30">
                  <CalendarDays className="h-12 w-12 mb-2" />
                  <span className="text-xs font-bold uppercase tracking-widest">Nenhum atendimento</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fontWeight: '700', fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontWeight: '700', fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={<CustomTooltip />}
                      cursor={{ fill: "hsl(var(--primary))", opacity: 0.05 }}
                    />
                    <Bar
                      dataKey="count"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                      animationBegin={0}
                      animationDuration={1500}
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.6 + (index / data.length) * 0.4}
                          style={{ filter: 'drop-shadow(0 4px 12px hsl(var(--primary) / 0.2))' }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {data.length <= 7 && data.length > 0 && (
              <div className="flex justify-around mt-4">
                {data.map((d, i) => (
                  <span key={i} className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/40">
                    {d.dayName}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAttendanceChart;
