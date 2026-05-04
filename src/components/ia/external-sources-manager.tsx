'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Loader2,
    Plus,
    Trash2,
    RefreshCw,
    FileText,
    Table2,
    Globe,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Clock,
    HardDrive,
    FolderOpen,
    Unplug,
    CloudDownload,
    Search,
} from 'lucide-react';

interface ExternalSource {
    id: string;
    name: string;
    sourceType: 'google_sheets' | 'pdf' | 'csv' | 'website';
    sourceUrl: string | null;
    originalFileName: string | null;
    syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
    syncError: string | null;
    lastSyncedAt: string | null;
    createdAt: string;
}

interface ExternalSourcesManagerProps {
    personaId?: string;
}

const SOURCE_TYPE_CONFIG = {
    google_sheets: {
        label: 'Google Sheets',
        icon: FileSpreadsheet,
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        needsUrl: true,
        acceptsFile: false,
    },
    pdf: {
        label: 'PDF',
        icon: FileText,
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        needsUrl: false,
        acceptsFile: true,
        accept: '.pdf',
        mimeType: 'application/pdf',
    },
    csv: {
        label: 'CSV',
        icon: Table2,
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        needsUrl: false,
        acceptsFile: true,
        accept: '.csv',
        mimeType: 'text/csv',
    },
    website: {
        label: 'Website',
        icon: Globe,
        color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
        needsUrl: true,
        acceptsFile: false,
    },
};

const SYNC_STATUS_CONFIG = {
    pending: { label: 'Pendente', icon: Clock, color: 'text-yellow-600' },
    syncing: { label: 'Sincronizando...', icon: Loader2, color: 'text-blue-600' },
    synced: { label: 'Sincronizado', icon: CheckCircle2, color: 'text-green-600' },
    error: { label: 'Erro', icon: AlertCircle, color: 'text-red-600' },
};

export function ExternalSourcesManager({ personaId }: ExternalSourcesManagerProps) {
    const { toast } = useToast();
    const [sources, setSources] = useState<ExternalSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    // Form state
    const [formType, setFormType] = useState<'google_sheets' | 'pdf' | 'csv' | 'website'>('google_sheets');
    const [formName, setFormName] = useState('');
    const [formUrl, setFormUrl] = useState('');
    const [formFile, setFormFile] = useState<File | null>(null);

    // Google Drive state
    const [driveConnected, setDriveConnected] = useState(false);
    const [driveLoading, setDriveLoading] = useState(true);
    const [driveFolders, setDriveFolders] = useState<{ id: string; name: string }[]>([]);
    const [driveFoldersLoading, setDriveFoldersLoading] = useState(false);
    const [driveSelectedFolder, setDriveSelectedFolder] = useState<string>('');
    const [driveSelectedFolderName, setDriveSelectedFolderName] = useState<string>('');
    const [driveSyncing, setDriveSyncing] = useState(false);
    const [driveLastSync, setDriveLastSync] = useState<string | null>(null);
    const [driveFolderSearch, setDriveFolderSearch] = useState('');

    const fetchSources = useCallback(async () => {
        if (!personaId) return;

        try {
            const response = await fetch(`/api/v1/ia/personas/${personaId}/sources`);
            if (response.ok) {
                const data = await response.json();
                setSources(data.sources || []);
            }
        } catch (error) {
            console.error('Error fetching sources:', error);
        } finally {
            setLoading(false);
        }
    }, [personaId]);




    // Fetch Google Drive connection status
    const fetchDriveStatus = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/integrations/google-drive/sync');
            if (response.ok) {
                const data = await response.json();
                setDriveConnected(data.connected);
                if (data.folderId) {
                    setDriveSelectedFolder(data.folderId);
                    setDriveSelectedFolderName(data.folderName || '');
                }
                setDriveLastSync(data.lastSyncAt);
            }
        } catch (error) {
            console.error('Error fetching Drive status:', error);
        } finally {
            setDriveLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSources();

        // Poll for sync status updates every 5 seconds
        const interval = setInterval(fetchSources, 5000);
        return () => clearInterval(interval);
    }, [fetchSources]);

    useEffect(() => {
        fetchDriveStatus();
    }, [fetchDriveStatus]);

    // Connect Google Drive
    const handleConnectDrive = async () => {
        try {
            const response = await fetch(`/api/v1/integrations/google-drive/connect?personaId=${personaId}`);
            if (response.ok) {
                const data = await response.json();
                // Navigate in same window so callback redirect brings user back correctly
                window.location.href = data.url;
            } else {
                throw new Error('Failed to get auth URL');
            }
        } catch (error) {
            toast({ title: 'Erro ao conectar Drive', variant: 'destructive' });
        }
    };

    // Disconnect Google Drive
    const handleDisconnectDrive = async () => {
        try {
            // We can use the sync endpoint or create a dedicated disconnect
            toast({ title: 'Para desconectar, remova o acesso no Google My Account.' });
        } catch (error) {
            console.error('Error disconnecting Drive:', error);
        }
    };

    // Load Drive folders (with optional search)
    const handleLoadFolders = async (search?: string) => {
        setDriveFoldersLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const response = await fetch(`/api/v1/integrations/google-drive/folders${params}`);
            if (response.ok) {
                const data = await response.json();
                setDriveFolders(data.folders || []);
            } else {
                throw new Error('Failed to load folders');
            }
        } catch (error) {
            toast({ title: 'Erro ao carregar pastas', variant: 'destructive' });
        } finally {
            setDriveFoldersLoading(false);
        }
    };

    // Debounced search for folders
    useEffect(() => {
        if (!driveConnected) return;
        const timer = setTimeout(() => {
            if (driveFolderSearch.length >= 2) {
                handleLoadFolders(driveFolderSearch);
            } else if (driveFolderSearch.length === 0 && driveFolders.length > 0) {
                // Reset to full list when search is cleared
                handleLoadFolders();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [driveFolderSearch, driveConnected]); // eslint-disable-line react-hooks/exhaustive-deps

    // Save selected folder
    const handleSaveFolder = async (folderId: string) => {
        const folder = driveFolders.find(f => f.id === folderId);
        try {
            const response = await fetch('/api/v1/integrations/google-drive/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderId,
                    folderName: folder?.name || folderId,
                    personaId,
                }),
            });
            if (response.ok) {
                setDriveSelectedFolder(folderId);
                setDriveSelectedFolderName(folder?.name || folderId);
                toast({ title: 'Pasta selecionada com sucesso!' });
            } else {
                throw new Error('Failed to save folder');
            }
        } catch (error) {
            toast({ title: 'Erro ao salvar pasta', variant: 'destructive' });
        }
    };

    // Manual sync
    const handleDriveSync = async () => {
        setDriveSyncing(true);
        try {
            const response = await fetch('/api/v1/integrations/google-drive/sync', {
                method: 'POST',
            });
            if (response.ok) {
                const data = await response.json();
                toast({
                    title: 'Sincronização concluída',
                    description: `${data.imported} importado(s), ${data.skipped} existente(s), ${data.errors} erro(s)`,
                });
                setDriveLastSync(new Date().toISOString());
                fetchSources(); // Refresh sources list
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Sync failed');
            }
        } catch (error) {
            toast({
                title: 'Erro na sincronização',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setDriveSyncing(false);
        }
    };

    const resetForm = () => {
        setFormName('');
        setFormUrl('');
        setFormFile(null);
        setFormType('google_sheets');
    };

    const handleAddSource = async () => {
        if (!personaId) return;

        const config = SOURCE_TYPE_CONFIG[formType];

        // Validation
        if (config.needsUrl && !formUrl) {
            toast({ title: 'URL é obrigatória', variant: 'destructive' });
            return;
        }
        if (config.acceptsFile && !formFile) {
            toast({ title: 'Arquivo é obrigatório', variant: 'destructive' });
            return;
        }

        setSubmitting(true);

        try {
            let response: Response;

            if (config.acceptsFile && formFile) {
                // File upload
                const formData = new FormData();
                formData.append('file', formFile);
                formData.append('name', formName || formFile.name.replace(/\.[^/.]+$/, ''));
                formData.append('sourceType', formType);

                response = await fetch(`/api/v1/ia/personas/${personaId}/sources`, {
                    method: 'POST',
                    body: formData,
                });
            } else {
                // URL-based source
                response = await fetch(`/api/v1/ia/personas/${personaId}/sources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formName || `${config.label} - ${new Date().toLocaleDateString('pt-BR')}`,
                        sourceType: formType,
                        sourceUrl: formUrl,
                    }),
                });
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao adicionar fonte');
            }

            toast({ title: 'Fonte adicionada com sucesso! Sincronização iniciada.' });
            setDialogOpen(false);
            resetForm();
            fetchSources();
        } catch (error) {
            toast({
                title: 'Erro ao adicionar fonte',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSource = async (sourceId: string) => {
        if (!personaId) return;
        if (!confirm('Tem certeza que deseja excluir esta fonte? As seções RAG associadas também serão removidas.')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/ia/personas/${personaId}/sources/${sourceId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir fonte');
            }

            toast({ title: 'Fonte excluída com sucesso' });
            fetchSources();
        } catch (error) {
            toast({
                title: 'Erro ao excluir fonte',
                variant: 'destructive',
            });
        }
    };

    const handleResyncSource = async (sourceId: string) => {
        if (!personaId) return;

        setSyncingIds(prev => new Set(prev).add(sourceId));

        try {
            const response = await fetch(`/api/v1/ia/personas/${personaId}/sources/${sourceId}`, {
                method: 'POST',
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro ao sincronizar');
            }

            toast({ title: 'Sincronização iniciada' });
            fetchSources();
        } catch (error) {
            toast({
                title: 'Erro ao sincronizar',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(sourceId);
                return next;
            });
        }
    };

    if (!personaId) {
        return (
            <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                    Salve o agente primeiro para adicionar fontes externas.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Fontes de Conhecimento Externas</CardTitle>
                        <CardDescription>
                            Conecte planilhas, documentos e sites para enriquecer o conhecimento do agente.
                            O conteúdo é extraído e incorporado automaticamente.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Fonte
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>Nenhuma fonte externa configurada.</p>
                            <p className="text-sm">Adicione planilhas, PDFs ou sites para começar.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sources.map((source) => {
                                const typeConfig = SOURCE_TYPE_CONFIG[source.sourceType];
                                const statusConfig = SYNC_STATUS_CONFIG[source.syncStatus];
                                const TypeIcon = typeConfig.icon;
                                const StatusIcon = statusConfig.icon;
                                const isSyncing = source.syncStatus === 'syncing' || syncingIds.has(source.id);

                                return (
                                    <div
                                        key={source.id}
                                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                                                <TypeIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{source.name}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {typeConfig.label}
                                                    </Badge>
                                                    {source.sourceUrl && (
                                                        <span className="truncate max-w-[200px]">{source.sourceUrl}</span>
                                                    )}
                                                    {source.originalFileName && (
                                                        <span className="truncate max-w-[200px]">{source.originalFileName}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className={`flex items-center gap-1 text-sm ${statusConfig.color}`}>
                                                <StatusIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                                <span>{statusConfig.label}</span>
                                            </div>

                                            {source.lastSyncedAt && (
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(source.lastSyncedAt).toLocaleString('pt-BR')}
                                                </span>
                                            )}

                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleResyncSource(source.id)}
                                                    disabled={isSyncing}
                                                    title="Re-sincronizar"
                                                >
                                                    <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteSource(source.id)}
                                                    className="text-destructive hover:text-destructive"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {sources.some(s => s.syncStatus === 'error') && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400">
                                ⚠️ Algumas fontes apresentaram erros. Clique em re-sincronizar para tentar novamente.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Source Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Adicionar Fonte Externa</DialogTitle>
                        <DialogDescription>
                            Escolha o tipo de fonte e forneça as informações necessárias.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo de Fonte</Label>
                            <Select
                                value={formType}
                                onValueChange={(v) => {
                                    setFormType(v as typeof formType);
                                    setFormUrl('');
                                    setFormFile(null);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="google_sheets">
                                        <div className="flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Google Sheets (público)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="pdf">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Upload de PDF
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="csv">
                                        <div className="flex items-center gap-2">
                                            <Table2 className="h-4 w-4" />
                                            Upload de CSV
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="website">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-4 w-4" />
                                            Website
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Nome (opcional)</Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Ex: Catálogo de Produtos"
                            />
                        </div>

                        {SOURCE_TYPE_CONFIG[formType].needsUrl && (
                            <div className="space-y-2">
                                <Label>
                                    {formType === 'google_sheets' ? 'URL do Google Sheets' : 'URL do Site'}
                                </Label>
                                <Input
                                    type="url"
                                    value={formUrl}
                                    onChange={(e) => setFormUrl(e.target.value)}
                                    placeholder={
                                        formType === 'google_sheets'
                                            ? 'https://docs.google.com/spreadsheets/d/...'
                                            : 'https://exemplo.com/pagina'
                                    }
                                />
                                {formType === 'google_sheets' && (
                                    <p className="text-xs text-muted-foreground">
                                        A planilha precisa estar configurada como &quot;Qualquer pessoa com o link pode visualizar&quot;.
                                    </p>
                                )}
                            </div>
                        )}

                        {SOURCE_TYPE_CONFIG[formType].acceptsFile && (
                            <div className="space-y-2">
                                <Label>Arquivo</Label>
                                <Input
                                    type="file"
                                    accept={SOURCE_TYPE_CONFIG[formType].accept}
                                    onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Tamanho máximo: 5MB
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAddSource} disabled={submitting}>
                            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Adicionar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Google Drive Integration Card */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <HardDrive className="h-5 w-5" />
                            Google Drive
                        </CardTitle>
                        <CardDescription>
                            Conecte seu Google Drive para importar PDFs automaticamente de uma pasta.
                        </CardDescription>
                    </div>
                    {driveConnected ? (
                        <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Conectado
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            <Unplug className="h-3 w-3 mr-1" />
                            Desconectado
                        </Badge>
                    )}
                </CardHeader>
                <CardContent>
                    {driveLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : !driveConnected ? (
                        <div className="text-center py-6">
                            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground mb-4">
                                Conecte seu Google Drive para sincronizar PDFs automaticamente.
                            </p>
                            <Button onClick={handleConnectDrive}>
                                <HardDrive className="h-4 w-4 mr-2" />
                                Conectar Google Drive
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Folder Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4" />
                                    Pasta do Drive
                                </Label>
                                {driveSelectedFolder ? (
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="px-3 py-1">
                                            <FolderOpen className="h-3 w-3 mr-1" />
                                            {driveSelectedFolderName || driveSelectedFolder}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleLoadFolders()}
                                            disabled={driveFoldersLoading}
                                        >
                                            {driveFoldersLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => handleLoadFolders()}
                                        disabled={driveFoldersLoading}
                                    >
                                        {driveFoldersLoading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <FolderOpen className="h-4 w-4 mr-2" />
                                        )}
                                        Selecionar Pasta
                                    </Button>
                                )}

                                {driveFolders.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                value={driveFolderSearch}
                                                onChange={(e) => setDriveFolderSearch(e.target.value)}
                                                placeholder="Buscar pasta por nome..."
                                                className="pl-9"
                                            />
                                        </div>
                                        {driveFoldersLoading ? (
                                            <div className="flex items-center justify-center py-3">
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                <span className="text-sm text-muted-foreground">Buscando pastas...</span>
                                            </div>
                                        ) : (
                                            <Select
                                                value={driveSelectedFolder}
                                                onValueChange={(value) => handleSaveFolder(value)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione uma pasta..." />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    {driveFolders.map((folder) => (
                                                        <SelectItem key={folder.id} value={folder.id}>
                                                            {folder.name}
                                                        </SelectItem>
                                                    ))}
                                                    {driveFolders.length === 0 && (
                                                        <div className="py-3 text-center text-sm text-muted-foreground">
                                                            Nenhuma pasta encontrada
                                                        </div>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {driveFolders.length} pasta(s) encontrada(s)
                                            {driveFolderSearch && ` para "${driveFolderSearch}"`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Sync Controls */}
                            {driveSelectedFolder && (
                                <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        {driveLastSync ? (
                                            <span>
                                                Última sync: {new Date(driveLastSync).toLocaleString('pt-BR')}
                                            </span>
                                        ) : (
                                            <span>Nunca sincronizado</span>
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleDriveSync}
                                        disabled={driveSyncing}
                                        size="sm"
                                    >
                                        {driveSyncing ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <CloudDownload className="h-4 w-4 mr-2" />
                                        )}
                                        Sincronizar Agora
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
