import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Package } from "lucide-react";

interface ProductBreakdownProps {
  dateRange: DateRange;
}

interface ProductData {
  name: string;
  value: number;
  count: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
];

function ProductBreakdownSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}

export function ProductBreakdown({ dateRange }: ProductBreakdownProps) {
  const [data, setData] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchProductData();
    }

    const channel = supabase
      .channel('product-breakdown')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchProductData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, currentOrganization?.id]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      
      if (!currentOrganization?.id) return;

      let query = (supabase as any)
        .from('transactions')
        .select('product_name, amount')
        .eq('organization_id', currentOrganization.id);

      if (dateRange.from) {
        query = query.gte('purchase_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange.to) {
        query = query.lte('purchase_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data: transactions, error } = await query;
      
      if (error) throw error;

      // Group by product_name and sum amounts
      const grouped = ((transactions as any[]) || []).reduce((acc: Record<string, ProductData>, t: any) => {
        const name = t.product_name || 'Sem produto';
        if (!acc[name]) {
          acc[name] = { name, value: 0, count: 0 };
        }
        acc[name].value += Number(t.amount);
        acc[name].count += 1;
        return acc;
      }, {} as Record<string, ProductData>);

      const sorted = (Object.values(grouped) as ProductData[]).sort((a, b) => b.value - a.value);
      setData(sorted);
    } catch (error) {
      console.error('Error fetching product data:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.count} {item.count === 1 ? 'venda' : 'vendas'} ({((item.value / total) * 100).toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <ProductBreakdownSkeleton />;
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Vendas por Produto
        </CardTitle>
        <CardDescription>Distribuição de receita por produto</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhuma transação no período
          </div>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  formatter={(value) => <span className="text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
