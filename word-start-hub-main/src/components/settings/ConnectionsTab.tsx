import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Smartphone, Plus, Wifi, WifiOff, Loader2, Trash2, RefreshCw, Star,
    UserCheck, QrCode, Pencil, Shield, Phone, Link2, Webhook, Copy, Hash, X, ChevronDown
} from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useMultiWhatsApp, type WhatsAppConnection } from "@/hooks/useMultiWhatsApp";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Connection Status Badge ─────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
    const isOpen = status === "open";
    const isConnecting = status === "connecting";

    return (
        <Badge
            variant="outline"
            className={cn(
                "gap-1.5 text-xs font-medium px-2.5 py-0.5",
                isOpen && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                isConnecting && "bg-amber-500/10 text-amber-600 border-amber-500/20",
                !isOpen && !isConnecting && "bg-red-500/10 text-red-500 border-red-500/20"
            )}
        >
            {isOpen ? (
                <><div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Conectado</>
            ) : isConnecting ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Conectando</>
            ) : (
                <><div className="h-1.5 w-1.5 rounded-full bg-red-500" /> Desconectado</>
            )}
        </Badge>
    );
}

// ─── Connection Card ─────────────────────────────────────────
function ConnectionCard({
    conn,
    orgMembers,
    ghlUsers,
    isLoadingGhlUsers,
    onUpdate,
    onDelete,
    onReconnect,
    onCheckStatus,
    onUpdateWebhook
}: {
    conn: WhatsAppConnection;
    orgMembers: Array<{ id: string; full_name: string; avatar_url?: string; email?: string; role: string; is_admin: boolean }>;
    onUpdate: (id: string, updates: Partial<Pick<WhatsAppConnection, 'display_name' | 'assigned_user_id' | 'assigned_user_ids' | 'ghl_user_id' | 'is_default'>>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onReconnect: (id: string) => Promise<any>;
    onCheckStatus: (id: string) => Promise<any>;
    onUpdateWebhook: (id: string) => Promise<void>;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(conn.display_name || "");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isUpdatingWebhook, setIsUpdatingWebhook] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);

    const isConnected = conn.status === "open";
    const assignedMember = orgMembers.find((m) => m.id === conn.assigned_user_id);

    const handleSaveName = async () => {
        await onUpdate(conn.id, { display_name: editName.trim() || null });
        setIsEditing(false);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try { await onDelete(conn.id); } finally { setIsDeleting(false); }
    };

    const handleCheckStatus = async () => {
        setIsChecking(true);
        try { await onCheckStatus(conn.id); } finally { setIsChecking(false); }
    };

    const handleReconnect = async () => {
        setIsReconnecting(true);
        try {
            const result = await onReconnect(conn.id);
            if (result?.qrcode) setQrCode(result.qrcode);
        } finally { setIsReconnecting(false); }
    };

    const handleUpdateWebhook = async () => {
        setIsUpdatingWebhook(true);
        try { await onUpdateWebhook(conn.id); } finally { setIsUpdatingWebhook(false); }
    };

    const handleToggleAgent = (memberId: string) => {
        const currentIds = conn.assigned_user_ids || [];
        const newIds = currentIds.includes(memberId)
            ? currentIds.filter(id => id !== memberId)
            : [...currentIds, memberId];
        onUpdate(conn.id, { assigned_user_ids: newIds });
    };

    return (
        <>
            <Card className={cn(
                "group relative border-0 shadow-lg bg-card/80 backdrop-blur-sm transition-all hover:shadow-xl",
                conn.is_default && "ring-2 ring-primary/30"
            )}>
                {/* Default Star */}
                {conn.is_default && (
                    <div className="absolute -top-2 -right-2 p-1 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full shadow-lg">
                        <Star className="h-3 w-3 text-white fill-white" />
                    </div>
                )}

                <CardContent className="p-5 space-y-4">
                    {/* Header: Name + Status */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                                isConnected
                                    ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20"
                                    : "bg-gradient-to-br from-zinc-500/10 to-zinc-600/10"
                            )}>
                                {isConnected ? (
                                    <Wifi className="h-5 w-5 text-emerald-500" />
                                ) : (
                                    <WifiOff className="h-5 w-5 text-zinc-400" />
                                )}
                            </div>
                            <div className="min-w-0">
                                {isEditing ? (
                                    <div className="flex gap-1.5">
                                        <Input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-7 text-sm"
                                            autoFocus
                                            onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                                        />
                                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSaveName}>✓</Button>
                                        <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => setIsEditing(false)}>✕</Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-semibold text-sm truncate">
                                            {conn.display_name || conn.instance_name || "Sem nome"}
                                        </p>
                                        <button onClick={() => { setEditName(conn.display_name || ""); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                                            <Pencil className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex flex-col gap-0.5 mt-1">
                                    {conn.phone_number && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            +{conn.phone_number.length > 4 ? `${conn.phone_number.slice(0, 2)} ${conn.phone_number.slice(2, 4)} ${conn.phone_number.slice(4)}` : conn.phone_number}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1 font-mono">
                                        <Hash className="h-2.5 w-2.5" />
                                        {conn.instance_name}
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(conn.instance_name || "");
                                                toast.success("ID copiado!");
                                            }}
                                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity ml-0.5"
                                            title="Copiar ID da instância"
                                        >
                                            <Copy className="h-2.5 w-2.5" />
                                        </button>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <StatusBadge status={conn.status} />
                    </div>

                    {/* Agent Assignment */}
                    <div className="space-y-3 pt-2 border-t border-border/50">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Agentes Vitta Responsáveis</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1 bg-background/50">
                                            Adicionar <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px]">
                                        {orgMembers.map((member) => {
                                            const isChecked = (conn.assigned_user_ids || []).includes(member.id);
                                            return (
                                                <DropdownMenuCheckboxItem
                                                    key={member.id}
                                                    checked={isChecked}
                                                    onCheckedChange={() => handleToggleAgent(member.id)}
                                                    className="flex items-center justify-between"
                                                >
                                                    {member.full_name}
                                                    {member.is_admin && <Badge variant="outline" className="text-[9px] px-1 py-0 shadow-none ml-2">Admin</Badge>}
                                                </DropdownMenuCheckboxItem>
                                            )
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </Label>
                            
                            <div className="flex flex-wrap gap-1.5">
                                {(conn.assigned_user_ids || []).length > 0 ? (
                                    (conn.assigned_user_ids || []).map(id => {
                                        const m = orgMembers.find(member => member.id === id);
                                        if (!m) return null;
                                        return (
                                            <Badge key={id} variant="secondary" className="flex items-center gap-1 pr-1 pl-2 py-0.5 text-xs bg-secondary/50 hover:bg-secondary/80">
                                                {m.full_name}
                                                <button onClick={() => handleToggleAgent(id)} className="hover:bg-destructive/10 hover:text-destructive rounded-full p-0.5 transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        );
                                    })
                                ) : (
                                    <span className="text-xs text-muted-foreground italic px-1">Nenhum agente restrito (todos os administradores veem)</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Link2 className="h-3.5 w-3.5" />
                                ID Agente GHL
                            </Label>
                            {(ghlUsers || []).length > 0 ? (
                                <Select
                                    value={conn.ghl_user_id || "none"}
                                    onValueChange={(val) => onUpdate(conn.id, { ghl_user_id: val === "none" ? null : val })}
                                >
                                    <SelectTrigger className="h-9 text-sm bg-background/50">
                                        <SelectValue placeholder="Selecione o usuário no GHL" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            <span className="text-muted-foreground">Nenhum</span>
                                        </SelectItem>
                                        {(ghlUsers || []).map((u) => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={conn.ghl_user_id || ""}
                                    onChange={(e) => onUpdate(conn.id, { ghl_user_id: e.target.value || null })}
                                    placeholder={isLoadingGhlUsers ? "Carregando usuários..." : "ID do agente no GoHighLevel"}
                                    className="h-9 text-sm bg-background/50"
                                />
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                            {!conn.is_default && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs gap-1"
                                    onClick={() => onUpdate(conn.id, { is_default: true })}
                                >
                                    <Star className="h-3 w-3" />
                                    Padrão
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={handleCheckStatus}
                                disabled={isChecking}
                            >
                                {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Status
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={handleUpdateWebhook}
                                disabled={isUpdatingWebhook}
                            >
                                {isUpdatingWebhook ? <Loader2 className="h-3 w-3 animate-spin" /> : <Webhook className="h-3 w-3 text-blue-500" />}
                                Webhook
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={handleReconnect}
                                disabled={isReconnecting}
                            >
                                {isReconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <QrCode className="h-3 w-3" />}
                                Reconectar
                            </Button>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* QR Code Dialog */}
            <Dialog open={!!qrCode} onOpenChange={() => setQrCode(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5 text-primary" />
                            Escaneie o QR Code
                        </DialogTitle>
                        <DialogDescription>
                            Use o WhatsApp no celular para escanear o código e conectar "{conn.display_name || conn.instance_name}".
                        </DialogDescription>
                    </DialogHeader>
                    {qrCode && (
                        <div className="flex items-center justify-center p-4">
                            <img src={qrCode} alt="QR Code" className="w-64 h-64 rounded-xl" />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQrCode(null)}>Fechar</Button>
                        <Button onClick={async () => { await handleCheckStatus(); setQrCode(null); }}>
                            Verificar Conexão
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─── New Connection Dialog ───────────────────────────────────
function NewConnectionDialog({
    open,
    onOpenChange,
    onCreate,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (displayName: string, phoneNumber?: string) => Promise<any>;
}) {
    const [displayName, setDisplayName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);

    const handleCreate = async () => {
        if (!displayName.trim()) {
            toast.error("Nome da conexão é obrigatório");
            return;
        }
        setIsCreating(true);
        try {
            const result = await onCreate(displayName.trim(), phoneNumber.trim() || undefined);
            if (result?.qrcode) {
                setQrCode(result.qrcode);
            } else {
                onOpenChange(false);
            }
        } catch {
            // error handled in hook
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setDisplayName("");
        setPhoneNumber("");
        setQrCode(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Nova Conexão WhatsApp
                    </DialogTitle>
                    <DialogDescription>
                        Adicione um novo número de WhatsApp via Evolution API.
                    </DialogDescription>
                </DialogHeader>

                {qrCode ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-center p-4 bg-white rounded-xl">
                            <img src={qrCode} alt="QR Code" className="w-56 h-56" />
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                            Escaneie o QR Code com o WhatsApp do número <strong>{displayName}</strong>
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="conn-name">Nome da Conexão *</Label>
                            <Input
                                id="conn-name"
                                placeholder="Ex: Comercial, Suporte, Vendas..."
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                                Este nome aparecerá como tag nas conversas do chat.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="conn-phone">Número (opcional)</Label>
                            <Input
                                id="conn-phone"
                                placeholder="5511999999999"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Se informado, será associado à instância. Caso contrário, escaneie o QR.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        {qrCode ? "Fechar" : "Cancelar"}
                    </Button>
                    {!qrCode && (
                        <Button onClick={handleCreate} disabled={isCreating} className="gap-2 bg-gradient-to-r from-primary to-accent">
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                            Criar Conexão
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Component ──────────────────────────────────────────
export default function ConnectionsTab() {
    const {
        connections,
        isLoading,
        orgMembers,
        ghlUsers,
        isLoadingGhlUsers,
        createConnection,
        deleteConnection,
        updateConnection,
        checkConnectionStatus,
        reconnectConnection,
        updateConnectionWebhook,
        refetch,
    } = useMultiWhatsApp();

    const [showNewDialog, setShowNewDialog] = useState(false);

    // Check all statuses on mount
    useEffect(() => {
        if (connections.length > 0) {
            connections.forEach((conn) => {
                if (conn.instance_name) checkConnectionStatus(conn.id);
            });
        }
    }, [connections.length]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <div className="grid md:grid-cols-2 gap-4">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl">
                                <Smartphone className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div>
                                <CardTitle className="text-xl">Conexões WhatsApp</CardTitle>
                                <CardDescription>
                                    Gerencie seus números conectados via Evolution API
                                </CardDescription>
                            </div>
                        </div>
                        <Button
                            onClick={() => setShowNewDialog(true)}
                            className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/25"
                        >
                            <Plus className="h-4 w-4" />
                            Nova Conexão
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-background/50 text-center">
                            <p className="text-2xl font-bold text-primary">{connections.length}</p>
                            <p className="text-xs text-muted-foreground">Conexões</p>
                        </div>
                        <div className="p-3 rounded-xl bg-background/50 text-center">
                            <p className="text-2xl font-bold text-emerald-500">
                                {connections.filter((c) => c.status === "open").length}
                            </p>
                            <p className="text-xs text-muted-foreground">Online</p>
                        </div>
                        <div className="p-3 rounded-xl bg-background/50 text-center">
                            <p className="text-2xl font-bold text-amber-500">
                                {/* Fix 6: count connections with any agent assigned (array or legacy field) */}
                            {connections.filter((c) =>
                                (c.assigned_user_ids?.length ?? 0) > 0 || !!c.assigned_user_id
                            ).length}
                            </p>
                            <p className="text-xs text-muted-foreground">Com Agente</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Isolation Info */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-500/5 to-indigo-500/5 backdrop-blur-sm">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg shrink-0 mt-0.5">
                            <Shield className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="text-sm">
                            <p className="font-medium text-blue-600 dark:text-blue-400">Isolamento por Canal Inteligente</p>
                            <p className="text-muted-foreground text-xs mt-0.5">
                                Atribua <strong>quantos agentes Vitta precisar</strong> a cada conexão para que eles vejam as conversas desse número (Administradores veem tudo livremente). 
                                Caso use GoHighLevel, você pode atribuir um <strong>Agente Oficial GHL</strong> nativo selecionando-o na lista para garantir isolamento sincronizado lá dentro também!
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Connections Grid */}
            {connections.length === 0 ? (
                <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-12 text-center space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 flex items-center justify-center">
                            <Smartphone className="h-8 w-8 text-emerald-500/60" />
                        </div>
                        <div>
                            <p className="font-medium">Nenhuma conexão configurada</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Clique em "Nova Conexão" para adicionar seu primeiro número de WhatsApp.
                            </p>
                        </div>
                        <Button
                            onClick={() => setShowNewDialog(true)}
                            className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600"
                        >
                            <Plus className="h-4 w-4" />
                            Criar Primeira Conexão
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {connections.map((conn) => (
                        <ConnectionCard
                            key={conn.id}
                            conn={conn}
                            orgMembers={orgMembers}
                            ghlUsers={ghlUsers}
                            isLoadingGhlUsers={isLoadingGhlUsers}
                            onUpdate={updateConnection}
                            onDelete={deleteConnection}
                            onReconnect={reconnectConnection}
                            onCheckStatus={checkConnectionStatus}
                            onUpdateWebhook={updateConnectionWebhook}
                        />
                    ))}
                </div>
            )}

            {/* New Connection Dialog */}
            <NewConnectionDialog
                open={showNewDialog}
                onOpenChange={setShowNewDialog}
                onCreate={createConnection}
            />
        </div>
    );
}
