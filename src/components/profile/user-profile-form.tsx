'use client';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useRouter } from 'next/navigation';
import { useSession } from '@/contexts/session-context';
import { useState, useMemo, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Password strength indicator ───────────────────────────────────────────
function PasswordStrengthIndicator({ checks }: { checks: { label: string; valid: boolean }[] }) {
  return (
    <div className="pt-2 space-y-1">
      {checks.map(check => (
        <div key={check.label} className={cn('flex items-center gap-2 text-xs', check.valid ? 'text-green-600' : 'text-muted-foreground')}>
          {check.valid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          <span>{check.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Change Password Dialog ─────────────────────────────────────────────────
function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const passwordChecks = useMemo(() => [
    { label: 'Pelo menos 8 caracteres', valid: newPassword.length >= 8 },
    { label: 'Pelo menos uma letra maiúscula', valid: /[A-Z]/.test(newPassword) },
    { label: 'Pelo menos uma letra minúscula', valid: /[a-z]/.test(newPassword) },
    { label: 'Pelo menos um número', valid: /[0-9]/.test(newPassword) },
  ], [newPassword]);

  const isPasswordStrong = passwordChecks.every(c => c.valid);

  const handleClose = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordStrong) {
      notify.error('Senha Fraca', 'A nova senha não atende os requisitos de segurança.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error('Senhas não coincidem', 'A confirmação da senha é diferente da nova senha.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify.success('Senha Alterada!', 'Sua senha foi alterada com sucesso.');
      handleClose();
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription>
            Recomendamos usar uma senha forte que você não usa em outro lugar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {newPassword.length > 0 && <PasswordStrengthIndicator checks={passwordChecks} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <XCircle className="h-3 w-3" /> As senhas não coincidem.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !isPasswordStrong || newPassword !== confirmPassword || !currentPassword}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Salvando...' : 'Atualizar Senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Change Email Dialog ────────────────────────────────────────────────────
function ChangeEmailDialog({ open, onOpenChange, currentEmail }: { open: boolean; onOpenChange: (v: boolean) => void; currentEmail: string }) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = useCallback(() => {
    setNewEmail('');
    setCurrentPassword('');
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !currentPassword) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_email', newEmail, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify.success('E-mail Alterado!', 'Faça login novamente com seu novo e-mail.');
      handleClose();
      // Redirecionar para login pois o email da sessão mudou
      setTimeout(() => router.push('/login'), 1500);
    } catch (error) {
      notify.error('Erro', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar E-mail</DialogTitle>
          <DialogDescription>
            E-mail atual: <strong>{currentEmail}</strong>. Após a alteração, você será redirecionado para o login.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo E-mail</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password-email">Confirme sua Senha Atual</Label>
              <Input
                id="confirm-password-email"
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Sua senha atual"
                required
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !newEmail || !currentPassword || newEmail === currentEmail}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Salvando...' : 'Alterar E-mail'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export function UserProfileForm(): JSX.Element {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();
  const { session } = useSession();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const handleSaveChanges = (): void => {
    notify.success('Perfil Atualizado!', 'Suas informações foram salvas com sucesso.');
  };

  const handleLogout = (): void => {
    router.push('/login');
  };

  return (
    <div className="space-y-8">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais aqui.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt="Avatar" data-ai-hint="avatar user" />
                <AvatarFallback>{session?.userData?.name?.substring(0, 2) || 'U'}</AvatarFallback>
              </Avatar>
              <Input id="avatar-upload" type="file" className="max-w-xs" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome Completo</Label>
            <Input id="full-name" defaultValue={session?.userData?.name || ''} />
          </div>

          {/* Email with change button */}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                value={session?.userData?.email || ''}
                readOnly
                className="flex-1 bg-muted/30 cursor-default"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailDialogOpen(true)}
                className="shrink-0"
              >
                Alterar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Para alterar seu e-mail você precisará confirmar sua senha atual.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Segurança</CardTitle>
          <CardDescription>Gerencie suas configurações de segurança.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preferências da Interface</CardTitle>
          <CardDescription>Personalize a aparência e o idioma do Master IA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Idioma</Label>
            <Select defaultValue="pt-br">
              <SelectTrigger id="language" className="w-[200px]">
                <SelectValue placeholder="Selecione um idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-br">Português (Brasil)</SelectItem>
                <SelectItem value="en-us">Inglês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">Tema</Label>
            <Select defaultValue="system">
              <SelectTrigger id="theme" className="w-[200px]">
                <SelectValue placeholder="Selecione um tema" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Automático (Sistema)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button variant="destructive" onClick={handleLogout}>Sair (Logout)</Button>
        <Button onClick={handleSaveChanges}>Salvar Alterações</Button>
      </div>

      {/* Dialogs */}
      <ChangePasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
      <ChangeEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        currentEmail={session?.userData?.email || ''}
      />
    </div>
  );
}
