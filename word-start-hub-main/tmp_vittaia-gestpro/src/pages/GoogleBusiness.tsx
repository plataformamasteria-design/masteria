import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import PagePermissionGuard from '@/components/PagePermissionGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Star, MessageSquare, BarChart3, MapPin, Settings, Send, Image, Clock, TrendingUp, Eye, Phone, Globe, RefreshCw, Loader2, AlertCircle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from '@/hooks/use-toast';

const GoogleBusiness = () => {
  const { currentOrganization } = useOrganization();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<any>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [postContent, setPostContent] = useState('');
  const [activeTab, setActiveTab] = useState('reviews');

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code) {
      const exchangeCode = async () => {
        try {
          const redirectUri = `${window.location.origin}/google-business`;
          const { data, error } = await supabase.functions.invoke('google-business-api', {
            body: {
              action: 'exchange_code',
              organization_id: state || currentOrganization?.id,
              code,
              redirect_uri: redirectUri,
            },
          });
          if (error) throw error;
          if (data?.success) {
            toast({ title: 'Conectado!', description: 'Google Meu Negócio conectado com sucesso.' });
            setIsConnected(true);
            loadData();
          } else if (data?.error) {
            toast({ title: 'Erro', description: data.error, variant: 'destructive' });
          }
        } catch (err: any) {
          toast({ title: 'Erro na conexão', description: err.message, variant: 'destructive' });
        }
        window.history.replaceState({}, '', '/google-business');
      };
      exchangeCode();
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [currentOrganization?.id]);

  const checkConnection = async () => {
    if (!currentOrganization?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('google-business-api', {
        body: { action: 'check_connection', organization_id: currentOrganization.id },
      });
      if (!error && data?.connected) {
        setIsConnected(true);
        loadData();
      }
    } catch {
      // Not connected
    }
  };

  const handleConnect = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/google-business`;
      const { data, error } = await supabase.functions.invoke('google-business-api', {
        body: {
          action: 'get_auth_url',
          organization_id: currentOrganization.id,
          redirect_uri: redirectUri,
        },
      });
      if (error) throw error;
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      } else if (data?.error) {
        toast({ title: 'Erro', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message || 'Erro ao conectar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    try {
      const [reviewsRes, insightsRes, infoRes] = await Promise.all([
        supabase.functions.invoke('google-business-api', {
          body: { action: 'list_reviews', organization_id: currentOrganization.id },
        }),
        supabase.functions.invoke('google-business-api', {
          body: { action: 'get_insights', organization_id: currentOrganization.id },
        }),
        supabase.functions.invoke('google-business-api', {
          body: { action: 'get_business_info', organization_id: currentOrganization.id },
        }),
      ]);
      if (reviewsRes.data?.reviews) setReviews(reviewsRes.data.reviews);
      if (insightsRes.data) setInsights(insightsRes.data);
      if (infoRes.data) setBusinessInfo(infoRes.data);
    } catch {
      // Handle errors silently
    } finally {
      setLoading(false);
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    if (!replyText[reviewId] || !currentOrganization?.id) return;
    try {
      await supabase.functions.invoke('google-business-api', {
        body: {
          action: 'reply_review',
          organization_id: currentOrganization.id,
          review_id: reviewId,
          reply: replyText[reviewId],
        },
      });
      toast({ title: 'Resposta enviada!' });
      setReplyText(prev => ({ ...prev, [reviewId]: '' }));
      loadData();
    } catch {
      toast({ title: 'Erro ao enviar resposta', variant: 'destructive' });
    }
  };

  const handleCreatePost = async () => {
    if (!postContent || !currentOrganization?.id) return;
    try {
      await supabase.functions.invoke('google-business-api', {
        body: {
          action: 'create_post',
          organization_id: currentOrganization.id,
          content: postContent,
        },
      });
      toast({ title: 'Post publicado!' });
      setPostContent('');
    } catch {
      toast({ title: 'Erro ao publicar', variant: 'destructive' });
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`h-4 w-4 ${s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  if (!isConnected) {
    return (
      <AppShell>
        <PagePermissionGuard page="dashboard">
          <div className="flex items-center justify-center h-full min-h-[60vh]">
            <Card className="w-full max-w-lg">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Google Meu Negócio</CardTitle>
                <CardDescription>
                  Conecte sua conta do Google para gerenciar avaliações, publicar posts e acompanhar métricas do seu negócio.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Button onClick={handleConnect} disabled={loading} size="lg" className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                  Conectar Google Meu Negócio
                </Button>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>Você precisa ter as credenciais OAuth do Google configuradas nas Organizações antes de conectar.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </PagePermissionGuard>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PagePermissionGuard page="dashboard">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Google Meu Negócio</h1>
              <p className="text-muted-foreground text-sm">
                {businessInfo?.name || 'Gerencie seu perfil no Google'}
              </p>
            </div>
            <Button variant="outline" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Métricas rápidas */}
          {insights && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Eye className="h-4 w-4" />
                    Visualizações
                  </div>
                  <p className="text-2xl font-bold">{insights.views || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Buscas
                  </div>
                  <p className="text-2xl font-bold">{insights.searches || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Phone className="h-4 w-4" />
                    Ligações
                  </div>
                  <p className="text-2xl font-bold">{insights.calls || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Star className="h-4 w-4" />
                    Avaliação
                  </div>
                  <p className="text-2xl font-bold">{insights.averageRating?.toFixed(1) || '–'}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="reviews" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Avaliações
              </TabsTrigger>
              <TabsTrigger value="posts" className="gap-1.5">
                <Image className="h-4 w-4" />
                Posts
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings className="h-4 w-4" />
                Perfil
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="space-y-3 mt-4">
              {reviews.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Nenhuma avaliação encontrada.</p>
                    <p className="text-sm">As avaliações do Google aparecerão aqui quando conectado.</p>
                  </CardContent>
                </Card>
              ) : (
                reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{review.author?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{review.author || 'Anônimo'}</p>
                            {renderStars(review.rating || 0)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {review.date || ''}
                        </div>
                      </div>
                      {review.comment && <p className="text-sm">{review.comment}</p>}
                      {review.reply ? (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Sua resposta:</p>
                          <p className="text-sm">{review.reply}</p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Escrever resposta..."
                            value={replyText[review.id] || ''}
                            onChange={(e) => setReplyText(prev => ({ ...prev, [review.id]: e.target.value }))}
                            className="flex-1"
                          />
                          <Button size="sm" onClick={() => handleReplyReview(review.id)} disabled={!replyText[review.id]}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="posts" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Nova Publicação</CardTitle>
                  <CardDescription>Crie um post ou oferta no seu perfil do Google</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Escreva o conteúdo do seu post..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleCreatePost} disabled={!postContent}>
                      <Plus className="h-4 w-4 mr-2" />
                      Publicar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insights" className="space-y-4 mt-4">
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>Insights detalhados aparecerão aqui quando conectado à API.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              {businessInfo ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Informações do Negócio</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="font-medium">{businessInfo.name || '–'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                      <p>{businessInfo.address || '–'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                      <p>{businessInfo.phone || '–'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Categoria</label>
                      <p>{businessInfo.category || '–'}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p>Informações do perfil aparecerão aqui quando conectado.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </PagePermissionGuard>
    </AppShell>
  );
};

export default GoogleBusiness;
