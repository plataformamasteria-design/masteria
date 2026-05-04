'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type ChartType = 'line' | 'area' | 'bar';

interface TimeSeriesChartProps {
  title: string;
  data: any[];
  type: ChartType;
  dataKeys: { key: string; color: string; name: string }[];
  loading?: boolean;
  height?: number;
}

export function TimeSeriesChart({
  title,
  data,
  type,
  dataKeys,
  loading = false,
  height = 300,
}: TimeSeriesChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height: `${height}px` }} />
        </CardContent>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 20, left: 0, bottom: 5 },
    };

    const xAxis = <XAxis dataKey="date" stroke="#888888" fontSize={12} />;
    const yAxis = <YAxis stroke="#888888" fontSize={12} />;
    const grid = <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />;
    const tooltip = (
      <Tooltip
        contentStyle={{
          backgroundColor: 'hsl(var(--popover))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px',
        }}
      />
    );
    const legend = <Legend />;

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {dataKeys.map((dk) => (
              <Line
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                name={dk.name}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1000}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {dataKeys.map((dk) => (
              <Area
                key={dk.key}
                type="monotone"
                dataKey={dk.key}
                stroke={dk.color}
                fill={dk.color}
                fillOpacity={0.3}
                name={dk.name}
                animationDuration={1000}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            {legend}
            {dataKeys.map((dk) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                fill={dk.color}
                name={dk.name}
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <Card className="animate-in fade-in-50 duration-500">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
