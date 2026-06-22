'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Globe, UserPlus, ArrowRightLeft, Tag, UserCheck, Rocket, Clock, Play, Pause, Pencil, Trash2, Loader2, Check, X, Search, Filter, Copy, MoreHorizontal, Download, Bot, LayoutGrid, List as ListIcon, AlignJustify } from 'lucide-react';
import { listFlows, deleteFlow, renameFlow, cloneFlow, toggleFlowStatus } from '@/lib/automations';
import { useSession } from '@/contexts/session-context';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const TRIGGER_ICONS: Record<string, { icon: any, color: string }> = {
    'message_received': { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
    'webhook': { icon: Globe, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
    'contact_created': { icon: UserPlus, color: 'text-green-500 bg-green-500/10 border-green-500/20' },
    'stage_changed': { icon: ArrowRightLeft, color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
    'contact_tag_added': { icon: Tag, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
    'lead_assigned': { icon: UserCheck, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
    'campaign_dispatched': { icon: Rocket, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
    'schedule': { icon: Clock, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20' },
    'manual': { icon: Play, color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20' },
};


interface AutomationListProps {
  onEdit: (id: string) => void;
  refreshTrigger?: number;
}

export function AutomationList({ onEdit, refreshTrigger }: AutomationListProps) {
  const { session, loading: sessionLoading } = useSession();
  const [flows, setFlows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (sessionLoading) return;
      if (!session?.empresaId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await listFlows(session.empresaId);
        setFlows(data || []);
      } catch (error) {
        console.error('Erro ao carregar automações:', error);
        toast.error('Não foi possível carregar as automações.');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [session?.empresaId, sessionLoading, refreshTrigger]);

  const handleDelete = async (id: string) => {
    if (!session?.empresaId) return;

    try {
      await deleteFlow(id, session.empresaId);
      setFlows(flows.filter(f => f.id !== id));
      toast.success('Automação excluída com sucesso.');
    } catch (error) {
      toast.error('Erro ao excluir automação.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRename = async (id: string) => {
    if (!session?.empresaId || !newName.trim()) return;

    try {
      const result = await renameFlow(id, newName.trim(), session.empresaId);
      if (result.success) {
        setFlows(flows.map(f => f.id === id ? { ...f, name: newName.trim() } : f));
        setRenamingId(null);
        setNewName('');
        toast.success('Automação renomeada com sucesso.');
      }
    } catch (error) {
      toast.error('Erro ao renomear automação.');
    }
  };

  const handleClone = async (id: string) => {
    if (!session?.empresaId) return;
    const promise = cloneFlow(id, session.empresaId);

    toast.promise(promise, {
      loading: 'Clonando automação...',
      success: (result) => {
        setFlows([result.flow, ...flows]);
        return 'Automação clonada com sucesso!';
      },
      error: 'Erro ao clonar automação.'
    });
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!session?.empresaId) return;
    const newStatus = !currentStatus;

    try {
      // Otimista
      setFlows(flows.map(f => f.id === id ? { ...f, isActive: newStatus } : f));

      const result = await toggleFlowStatus(id, newStatus, session.empresaId);
      if (!result.success) {
        throw new Error();
      }
      toast.success(newStatus ? 'Automação ativada' : 'Automação pausada');
    } catch (error) {
      // Reverter
      setFlows(flows.map(f => f.id === id ? { ...f, isActive: currentStatus } : f));
      toast.error('Erro ao alterar status.');
    }
  };

  const handleExport = (flow: any) => {
    try {
      const exportData = {
        _format: "master-ia-automation-v2",
        name: flow.name,
        visualData: flow.visualData,
        executionLogic: flow.executionLogic,
        exported_at: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = flow.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      a.download = `automacao-${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Automação exportada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar:', err);
      toast.error('Erro ao exportar automação.');
    }
  };

  const filteredFlows = flows.filter(flow => {
    const matchesSearch = flow.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      ? true
      : statusFilter === 'active' ? flow.isActive : !flow.isActive;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-full md:w-[200px] rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-[140px] w-full rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Pesquisa e Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar automações..."
            className="pl-10 h-11 rounded-[14px] bg-white/[0.02] border border-zinc-200 dark:border-white/5 text-[13px] text-zinc-900 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-zinc-50 dark:focus:bg-white/[0.04] focus:border-zinc-300 dark:focus:border-white/20 transition-all duration-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="hidden md:flex items-center bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[14px] p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 rounded-xl ${viewMode === 'grid' ? 'bg-zinc-100 dark:bg-white/[0.05] shadow-sm' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grade"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 rounded-xl ${viewMode === 'list' ? 'bg-zinc-100 dark:bg-white/[0.05] shadow-sm' : ''}`}
            onClick={() => setViewMode('list')}
            title="Lista"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'compact' ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 rounded-xl ${viewMode === 'compact' ? 'bg-zinc-100 dark:bg-white/[0.05] shadow-sm' : ''}`}
            onClick={() => setViewMode('compact')}
            title="Compacto"
          >
            <AlignJustify className="h-4 w-4" />
          </Button>
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="h-11 w-full md:w-[200px] rounded-[14px] bg-white/[0.02] border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-all duration-300">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Filtrar por status" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300">
            <SelectItem value="all" className="hover:bg-zinc-100 dark:hover:bg-white/5">Todos os Status</SelectItem>
            <SelectItem value="active" className="hover:bg-zinc-100 dark:hover:bg-white/5">Apenas Ativas</SelectItem>
            <SelectItem value="paused" className="hover:bg-zinc-100 dark:hover:bg-white/5">Apenas Pausadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2" : "flex flex-col gap-4"}>
        {filteredFlows.map((flow) => {
          const TriggerIcon = TRIGGER_ICONS[flow.triggerType]?.icon || MessageSquare;
          const triggerColor = TRIGGER_ICONS[flow.triggerType]?.color || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
          return (
          <Card key={flow.id} className={`group relative transition-all duration-500 hover:shadow-sm dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:-translate-y-1 overflow-hidden border border-zinc-200 dark:border-white/10 bg-white/[0.02] backdrop-blur-md ${viewMode === 'grid' ? 'rounded-[2rem]' : viewMode === 'compact' ? 'rounded-xl' : 'rounded-2xl'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            
            {viewMode === 'grid' && (
              <>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 p-6 pb-4">
                  <div className="space-y-1.5 flex-1 pr-2">
                    {renamingId === flow.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          autoFocus
                          className="h-8 text-sm font-bold border-blue-200 focus:ring-blue-100"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(flow.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                        />
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 rounded-lg" onClick={() => handleRename(flow.id)}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 bg-red-50/50 rounded-lg" onClick={() => setRenamingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-xl border flex items-center justify-center shrink-0 ${triggerColor}`} title="Gatilho da automação">
                            <TriggerIcon className="w-5 h-5" />
                        </div>
                        <CardTitle className="text-lg font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-1" onClick={() => { setRenamingId(flow.id); setNewName(flow.name); }}>
                          {flow.name}
                        </CardTitle>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CardDescription className="text-[12px] font-medium text-zinc-500">
                        Criado em {new Date(flow.createdAt).toLocaleDateString()}
                      </CardDescription>
                      <span className="text-zinc-400 dark:text-zinc-700">•</span>
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium bg-zinc-100 dark:bg-white/[0.03] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-white/5">v2.0</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={flow.isActive} onCheckedChange={() => handleToggleStatus(flow.id, flow.isActive)} className="data-[state=checked]:bg-emerald-500 scale-90" />
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-5 flex justify-between items-center bg-transparent border-t border-zinc-200 dark:border-white/5">
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-xl transition-all" onClick={() => onEdit(flow.id)} title="Editar Fluxo"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all" onClick={() => handleClone(flow.id)} title="Clonar Automação"><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-10 w-10 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all" onClick={() => handleExport(flow)} title="Exportar Automação"><Download className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-10 w-10 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all" title="Excluir"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold text-zinc-900 dark:text-white">Excluir Automação?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo <span className="font-bold text-zinc-900 dark:text-white">"{flow.name}"</span> e todos os logs associados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel className="rounded-2xl border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.02] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.05]">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(flow.id)} className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border-none">Excluir Agora</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-[0.1em]">Última Alteração</span>
                    <span className="text-[12px] text-zinc-300 font-bold">{new Date(flow.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </CardContent>
              </>
            )}

            {viewMode === 'list' && (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 gap-4">
                <div className="flex-1 space-y-1 pr-2">
                    {renamingId === flow.id ? (
                      <div className="flex items-center gap-2">
                        <Input autoFocus className="h-8 text-sm font-bold border-blue-200 focus:ring-blue-100 max-w-[300px]" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(flow.id); if (e.key === 'Escape') setRenamingId(null); }} />
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 rounded-lg" onClick={() => handleRename(flow.id)}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 bg-red-50/50 rounded-lg" onClick={() => setRenamingId(null)}><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${triggerColor}`} title="Gatilho da automação">
                            <TriggerIcon className="w-4 h-4" />
                        </div>
                        <div className="text-base font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors line-clamp-1" onClick={() => { setRenamingId(flow.id); setNewName(flow.name); }}>
                          {flow.name}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-zinc-500">Criado em {new Date(flow.createdAt).toLocaleDateString()}</span>
                      <span className="text-zinc-400 dark:text-zinc-700">•</span>
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium bg-zinc-100 dark:bg-white/[0.03] px-2 py-0.5 rounded-full border border-zinc-200 dark:border-white/5">v2.0</span>
                    </div>
                </div>
                
                <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6 w-full md:w-auto mt-2 md:mt-0">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-xl transition-all" onClick={() => onEdit(flow.id)} title="Editar Fluxo"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-xl transition-all" onClick={() => handleClone(flow.id)} title="Clonar Automação"><Copy className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all" onClick={() => handleExport(flow)} title="Exportar Automação"><Download className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all" title="Excluir"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold text-zinc-900 dark:text-white">Excluir Automação?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo <span className="font-bold text-zinc-900 dark:text-white">"{flow.name}"</span> e todos os logs associados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel className="rounded-2xl border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.02] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.05]">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(flow.id)} className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border-none">Excluir Agora</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 min-w-[100px] hidden lg:flex">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-[0.1em]">Última Alteração</span>
                    <span className="text-[12px] text-zinc-300 font-bold">{new Date(flow.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-zinc-200 dark:border-white/10 ml-auto md:ml-0">
                    <Switch checked={flow.isActive} onCheckedChange={() => handleToggleStatus(flow.id, flow.isActive)} className="data-[state=checked]:bg-emerald-500 scale-90" />
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'compact' && (
              <div className="flex items-center justify-between p-3 px-4 gap-4">
                <div className="flex-1 flex items-center gap-3 pr-2 min-w-0">
                    {renamingId === flow.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input autoFocus className="h-7 text-sm font-bold border-blue-200 focus:ring-blue-100 flex-1 max-w-[300px]" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(flow.id); if (e.key === 'Escape') setRenamingId(null); }} />
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 bg-emerald-50/50 rounded-lg" onClick={() => handleRename(flow.id)}><Check className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-50 bg-red-50/50 rounded-lg" onClick={() => setRenamingId(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`p-1 rounded-md border flex items-center justify-center shrink-0 ${triggerColor}`} title="Gatilho da automação">
                            <TriggerIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-sm font-bold text-zinc-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate" onClick={() => { setRenamingId(flow.id); setNewName(flow.name); }}>
                          {flow.name}
                        </div>
                        <span className="shrink-0 text-[10px] text-zinc-600 dark:text-zinc-300 font-medium bg-zinc-100 dark:bg-white/[0.03] px-1.5 py-0.5 rounded-full border border-zinc-200 dark:border-white/5">v2.0</span>
                      </>
                    )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.05] rounded-lg transition-all" onClick={() => onEdit(flow.id)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all" onClick={() => handleClone(flow.id)} title="Clonar"><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" onClick={() => handleExport(flow)} title="Exportar"><Download className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-bold text-zinc-900 dark:text-white">Excluir Automação?</AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-500 dark:text-zinc-400">Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo <span className="font-bold text-zinc-900 dark:text-white">"{flow.name}"</span> e todos os logs associados.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel className="rounded-2xl border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.02] text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-white/[0.05]">Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(flow.id)} className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white border-none">Excluir Agora</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  <div className="flex items-center pl-2 border-l border-zinc-200 dark:border-white/10">
                    <Switch checked={flow.isActive} onCheckedChange={() => handleToggleStatus(flow.id, flow.isActive)} className="data-[state=checked]:bg-emerald-500 scale-[0.8]" />
                  </div>
                </div>
              </div>
            )}
          </Card>
          );
        })}

        {(filteredFlows.length === 0 && flows.length > 0) && (
          <div className="col-span-full py-20 text-center border border-zinc-200 dark:border-white/5 border-dashed rounded-[2rem] bg-white/[0.01]">
            <div className="flex flex-col items-center gap-3">
              <Search className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
              <p className="text-zinc-900 dark:text-zinc-300 font-extrabold text-lg">Nenhum resultado encontrado</p>
              <p className="text-zinc-500 text-sm">
                Tente ajustar seus filtros ou termos de pesquisa.
              </p>
            </div>
          </div>
        )}

        {flows.length === 0 && (
          <div className="col-span-full py-20 text-center border border-zinc-200 dark:border-white/5 border-dashed rounded-[2rem] bg-white/[0.01]">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                <Bot className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <p className="text-zinc-900 dark:text-white font-extrabold text-xl">Inicie sua Automação</p>
                <p className="text-zinc-500 text-sm max-w-[320px] mx-auto leading-relaxed">
                  Clique no botão "Nova Automação" para criar fluxos inteligentes e escalar o atendimento.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
