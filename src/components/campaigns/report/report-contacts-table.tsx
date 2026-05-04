// src/components/campaigns/report/report-contacts-table.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, AlertCircle } from 'lucide-react';
import type { CampaignSend } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type StatusKey = 'read' | 'delivered' | 'sent' | 'failed' | 'SENT' | 'FAILED' ;

const statusConfig: Record<StatusKey, { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', className?: string }> = {
    read: { text: 'Lida', variant: 'default', className: 'bg-green-500 hover:bg-green-600' },
    delivered: { text: 'Entregue', variant: 'secondary' },
    sent: { text: 'Enviada', variant: 'outline', className: 'border-blue-500 text-blue-500' },
    failed: { text: 'Falhou', variant: 'destructive' },
    SENT: { text: 'Enviada', variant: 'outline', className: 'border-blue-500 text-blue-500' },
    FAILED: { text: 'Falhou', variant: 'destructive' },
};

export function ReportContactsTable({ deliveryReports }: { deliveryReports: CampaignSend[] }): JSX.Element {
  const [search, setSearch] = useState('');
  
  const filteredReports = deliveryReports.filter(
    report =>
      report.contactName.toLowerCase().includes(search.toLowerCase()) ||
      report.contactPhone.includes(search)
  );
  
  const title = 'Detalhes do Envio por Contato';
  const description = `Lista de todos os contatos e o status do envio para cada um.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            className="pl-9 w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Atualização</TableHead>
                <TableHead>Motivo da Falha</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReports.length > 0 ? filteredReports.map((report) => {
                const statusKey = (report.status?.toLowerCase() || 'sent') as StatusKey;
                const config = statusConfig[statusKey] || { text: report.status, variant: 'secondary' };

                return (
                    <TableRow key={report.id}>
                    <TableCell>
                        <div className="font-medium whitespace-nowrap">{report.contactName}</div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">{report.contactPhone}</div>
                    </TableCell>
                    <TableCell>
                        <Badge variant={config.variant} className={cn(config.className)}>
                          {config.text}
                        </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{report.updatedAt ? new Date(report.updatedAt).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell className="max-w-[300px]">
                      {report.failureReason ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 text-xs text-destructive cursor-help">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{report.failureReason}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm">
                              <p className="text-sm">{report.failureReason}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                        <Link href={`/contacts/${report.contactId}`} passHref>
                            <Button variant="outline" size="sm">
                                <User className="h-4 w-4 mr-2" />
                                Ver Perfil
                            </Button>
                        </Link>
                    </TableCell>
                    </TableRow>
                )
              }) : (
                 <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">Nenhum registo de entrega encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
