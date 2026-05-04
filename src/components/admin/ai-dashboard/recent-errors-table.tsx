// src/components/admin/ai-dashboard/recent-errors-table.tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecentErrorsTableProps {
  errors: any[];
}

export function RecentErrorsTable({ errors }: RecentErrorsTableProps) {
    if (!errors || errors.length === 0) {
        return <p className="text-center text-muted-foreground py-10">Nenhum erro recente encontrado.</p>;
    }
    
  return (
    <ScrollArea className="h-80">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agente</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {errors.map(error => (
            <TableRow key={error.id}>
              <TableCell>
                <p className="font-medium">{error.agentName}</p>
                <p className="text-xs text-destructive truncate" title={error.response}>{error.response}</p>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {error.createdAt ? formatDistanceToNow(new Date(error.createdAt), { addSuffix: true, locale: ptBR }) : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
