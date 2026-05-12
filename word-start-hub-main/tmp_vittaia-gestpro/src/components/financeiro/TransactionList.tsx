import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Search, ExternalLink, Edit2, Receipt, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/contexts/OrganizationContext";
import { TransactionDialog } from "./TransactionDialog";
import { LeadAvatar } from "@/components/leads/LeadAvatar";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  dateRange: DateRange;
}

interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  product_name: string | null;
  duration: string | null;
  purchase_date: string | null;
  created_at: string;
  chat_id: string;
  chats: {
    wa_name: string | null;
    phone: string;
    wa_photo_url: string | null;
    is_group?: boolean;
    group_name?: string | null;
    group_photo_url?: string | null;
  };
}

function TransactionListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-5 w-24 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TransactionList({ dateRange }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string | undefined>();
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchTransactions();
    }

    const channel = supabase
      .channel('transactions-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchTransactions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange, currentOrganization?.id]);

  useEffect(() => {
    if (search.trim() === "") {
      setFilteredTransactions(transactions);
    } else {
      const filtered = transactions.filter(t => 
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        t.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.duration?.toLowerCase().includes(search.toLowerCase()) ||
        t.chats?.wa_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.chats?.group_name?.toLowerCase().includes(search.toLowerCase()) ||
        t.chats?.phone.includes(search)
      );
      setFilteredTransactions(filtered);
    }
  }, [search, transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      if (!currentOrganization?.id) return;

      let query = (supabase as any)
        .from('transactions')
        .select(`
          id,
          amount,
          description,
          product_name,
          duration,
          purchase_date,
          created_at,
          chat_id,
          chats (
            wa_name,
            phone,
            wa_photo_url,
            is_group,
            group_name,
            group_photo_url
          )
        `)
        .eq('organization_id', currentOrganization.id)
        .order('purchase_date', { ascending: false, nullsFirst: false });

      if (dateRange.from) {
        query = query.gte('purchase_date', format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange.to) {
        query = query.lte('purchase_date', format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data } = await query;
      setTransactions(data as Transaction[] || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (chatId: string) => {
    navigate(`/chat?id=${chatId}`);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction.id);
    setSelectedChatId(transaction.chat_id);
    setDialogOpen(true);
  };

  const totalPeriod = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

  if (loading) {
    return <TransactionListSkeleton />;
  }

  return (
    <>
      <Card className="animate-fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Transações
              </CardTitle>
              <CardDescription>
                {filteredTransactions.length} transações • Total: R$ {totalPeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma transação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((transaction) => {
                    const isGroup = transaction.chats?.is_group || false;
                    const displayName = isGroup 
                      ? (transaction.chats?.group_name || transaction.chats?.phone || 'Sem nome')
                      : (transaction.chats?.wa_name || 'Sem nome');
                    const photoUrl = isGroup 
                      ? transaction.chats?.group_photo_url 
                      : transaction.chats?.wa_photo_url;

                    return (
                      <TableRow key={transaction.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <LeadAvatar
                              isGroup={isGroup}
                              photoUrl={photoUrl}
                              name={displayName}
                              size="sm"
                            />
                            <div>
                              <div className="flex items-center gap-1">
                                {isGroup && <Users className="h-3 w-3 text-green-500" />}
                                <span className="font-medium text-sm">{displayName}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.chats?.phone}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{transaction.product_name || '-'}</TableCell>
                        <TableCell className="text-sm">{transaction.duration || '-'}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          {transaction.description || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transaction.purchase_date 
                            ? format(parseISO(transaction.purchase_date), 'dd/MM/yyyy')
                            : format(parseISO(transaction.created_at), 'dd/MM/yyyy')
                          }
                        </TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          R$ {Number(transaction.amount).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEditTransaction(transaction)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleChatClick(transaction.chat_id)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        chatId={selectedChatId}
        transactionId={selectedTransaction}
        onSuccess={fetchTransactions}
      />
    </>
  );
}