import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PagePermissionGuard from '@/components/PagePermissionGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Inbox, Send, Star, Trash2, RefreshCw, Loader2, Plus, Paperclip, Search, Settings, AlertCircle, CheckCircle2, Clock, Reply, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EmailAccount {
  id: string;
  provider: 'gmail' | 'outlook' | 'imap';
  email: string;
  name: string;
  connected: boolean;
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: string;
  attachments?: string[];
}

const EmailPage = () => {
  const { currentOrganization } = useOrganization();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [searchQuery, setSearchQuery] = useState('');

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  // Add account state
  const [newAccountProvider, setNewAccountProvider] = useState<'gmail' | 'outlook' | 'imap'>('gmail');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // organization_id
    if (code) {
      const exchangeCode = async () => {
        try {
          const redirectUri = `${window.location.origin}/email`;
          const { data, error } = await supabase.functions.invoke('email-api', {
            body: {
              action: 'exchange_code',
              organization_id: state || currentOrganization?.id,
              code,
              redirect_uri: redirectUri,
            },
          });
          if (error) throw error;
          if (data?.success) {
            toast({ title: 'Email conectado!', description: `Conta ${data.email} conectada com sucesso.` });
          } else if (data?.error) {
            toast({ title: 'Erro', description: data.error, variant: 'destructive' });
          }
        } catch (err: any) {
          toast({ title: 'Erro na conexão', description: err.message, variant: 'destructive' });
        }
        // Clean URL
        window.history.replaceState({}, '', '/email');
        loadAccounts();
      };
      exchangeCode();
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (selectedAccount) {
      loadEmails();
    }
  }, [selectedAccount, activeFolder]);

  const loadAccounts = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: { action: 'list_accounts', organization_id: currentOrganization.id },
      });
      if (!error && data?.accounts) {
        setAccounts(data.accounts);
        if (data.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(data.accounts[0].id);
        }
      }
    } catch {
      // No accounts yet
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = async () => {
    if (!currentOrganization?.id || !selectedAccount) return;
    setLoadingEmails(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'list_emails',
          organization_id: currentOrganization.id,
          account_id: selectedAccount,
          folder: activeFolder,
        },
      });
      if (!error && data?.emails) {
        setEmails(data.emails);
      }
    } catch {
      // Handle error
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleConnectGmail = async () => {
    if (!currentOrganization?.id) return;
    try {
      const redirectUri = `${window.location.origin}/email`;
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'get_auth_url',
          organization_id: currentOrganization.id,
          redirect_uri: redirectUri,
        },
      });
      if (error) throw error;
      if (data?.auth_url) {
        // Use popup to avoid iframe cookie restrictions
        const popup = window.open(data.auth_url, 'gmail-oauth', 'width=600,height=700,left=200,top=100');
        if (!popup) {
          window.location.href = data.auth_url;
          return;
        }
        const pollTimer = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(pollTimer);
              loadAccounts();
              return;
            }
            const popupUrl = popup.location.href;
            if (popupUrl && popupUrl.includes('code=')) {
              const params = new URL(popupUrl).searchParams;
              const code = params.get('code');
              if (code) {
                popup.close();
                clearInterval(pollTimer);
                (async () => {
                  try {
                    const { data: exData, error: exErr } = await supabase.functions.invoke('email-api', {
                      body: { action: 'exchange_code', organization_id: currentOrganization?.id, code, redirect_uri: redirectUri },
                    });
                    if (exErr) throw exErr;
                    if (exData?.success) {
                      toast({ title: 'Email conectado!', description: `Conta ${exData.email} conectada com sucesso.` });
                    } else if (exData?.error) {
                      toast({ title: 'Erro', description: exData.error, variant: 'destructive' });
                    }
                  } catch (err: any) {
                    toast({ title: 'Erro na conexão', description: err.message, variant: 'destructive' });
                  }
                  loadAccounts();
                })();
              }
            }
          } catch {
            // Cross-origin - popup still on Google domain
          }
        }, 500);
      } else if (data?.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleConnectOutlook = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: { action: 'connect_outlook', organization_id: currentOrganization.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleConnectIMAP = async () => {
    if (!currentOrganization?.id || !accountEmail || !accountPassword) return;
    try {
      const { data, error } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'connect_imap',
          organization_id: currentOrganization.id,
          email: accountEmail,
          password: accountPassword,
          imap_host: imapHost,
          imap_port: parseInt(imapPort),
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort),
        },
      });
      if (error) throw error;
      toast({ title: 'Conta conectada!' });
      setAddAccountOpen(false);
      loadAccounts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleSendEmail = async () => {
    if (!currentOrganization?.id || !selectedAccount || !composeTo || !composeSubject) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('email-api', {
        body: {
          action: 'send_email',
          organization_id: currentOrganization.id,
          account_id: selectedAccount,
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
        },
      });
      if (error) throw error;
      toast({ title: 'Email enviado!' });
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const filteredEmails = emails.filter(e =>
    !searchQuery || e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.from.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // No accounts connected
  if (!loading && accounts.length === 0) {
    return (
      <AppShell>
        <PagePermissionGuard page="dashboard">
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <Card className="w-full max-w-lg">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Email</CardTitle>
                <CardDescription>
                  Conecte sua conta de email para ler e enviar mensagens diretamente pela plataforma.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button onClick={handleConnectGmail} variant="outline" className="w-full justify-start gap-3 h-14">
                  <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <Mail className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Gmail / Google Workspace</p>
                    <p className="text-xs text-muted-foreground">Conectar via OAuth</p>
                  </div>
                </Button>
                <Button onClick={handleConnectOutlook} variant="outline" className="w-full justify-start gap-3 h-14">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Mail className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">Outlook / Microsoft 365</p>
                    <p className="text-xs text-muted-foreground">Conectar via OAuth</p>
                  </div>
                </Button>
                <Button onClick={() => { setNewAccountProvider('imap'); setAddAccountOpen(true); }} variant="outline" className="w-full justify-start gap-3 h-14">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">IMAP / SMTP</p>
                    <p className="text-xs text-muted-foreground">Qualquer provedor de email</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* IMAP Dialog */}
          <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Conectar via IMAP/SMTP</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div className="space-y-2">
                  <Label>Senha / App Password</Label>
                  <Input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>IMAP Host</Label>
                    <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>IMAP Porta</Label>
                    <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Porta</Label>
                    <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddAccountOpen(false)}>Cancelar</Button>
                <Button onClick={handleConnectIMAP}>Conectar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PagePermissionGuard>
      </AppShell>
    );
  }

  return (
    <AppShell noPadding>
      <PagePermissionGuard page="dashboard">
        <div className="flex h-full w-full overflow-hidden">
          {/* Sidebar de emails */}
          <div className="w-full md:w-[380px] md:min-w-[320px] border-r flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {accounts.length > 1 ? (
                    <Select value={selectedAccount || ''} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-sm font-medium">{accounts[0]?.email || 'Email'}</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadEmails}>
                    <RefreshCw className={`h-4 w-4 ${loadingEmails ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" className="h-8 gap-1" onClick={() => setComposeOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Novo
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8"
                />
              </div>
              <div className="flex gap-1">
                {[
                  { id: 'inbox', icon: Inbox, label: 'Entrada' },
                  { id: 'sent', icon: Send, label: 'Enviados' },
                  { id: 'starred', icon: Star, label: 'Favoritos' },
                  { id: 'trash', icon: Trash2, label: 'Lixeira' },
                ].map(f => (
                  <Button
                    key={f.id}
                    variant={activeFolder === f.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setActiveFolder(f.id)}
                  >
                    <f.icon className="h-3.5 w-3.5" />
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Email list */}
            <ScrollArea className="flex-1">
              {loadingEmails ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum email nesta pasta</p>
                </div>
              ) : (
                filteredEmails.map(email => (
                  <button
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${selectedEmail?.id === email.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                      } ${!email.read ? 'bg-primary/[0.02]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!email.read ? 'font-semibold' : ''}`}>
                        {email.from}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {email.date ? format(new Date(email.date), 'dd/MM HH:mm', { locale: ptBR }) : ''}
                      </span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${!email.read ? 'font-medium' : 'text-muted-foreground'}`}>
                      {email.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.body?.substring(0, 80)}...
                    </p>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          {/* Email detail */}
          <div className="hidden md:flex flex-1 flex-col h-full">
            {selectedEmail ? (
              <>
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedEmail.subject}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        De: <span className="text-foreground">{selectedEmail.from}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Para: <span className="text-foreground">{selectedEmail.to}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body || '' }} />
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Selecione um email para visualizar</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Para</Label>
                <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="destinatario@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Assunto</Label>
                <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Assunto do email" />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Escreva sua mensagem..." rows={10} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancelar</Button>
              <Button onClick={handleSendEmail} disabled={sending || !composeTo || !composeSubject}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PagePermissionGuard>
    </AppShell>
  );
};

export default EmailPage;
