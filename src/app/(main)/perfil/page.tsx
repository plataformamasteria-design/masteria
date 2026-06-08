'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSession } from '@/contexts/session-context';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageHeader } from '@/components/page-header';
import {
  User, Mail, Lock, ShieldCheck, Camera, CheckCircle, XCircle,
  Loader2, LogOut, Save, Phone, Clock, FileText, AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

// ── Timezones ─────────────────────────────────────────────────────────────────
// Removed as it is not used in the database currently

// ── Password Strength ─────────────────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    { label: 'Mín. 8 caracteres', valid: password.length >= 8 },
    { label: 'Maiúscula', valid: /[A-Z]/.test(password) },
    { label: 'Minúscula', valid: /[a-z]/.test(password) },
    { label: 'Número', valid: /[0-9]/.test(password) },
  ];
  const strength = checks.filter(c => c.valid).length;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500'];
  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-all duration-300', i < strength ? colors[strength - 1] : 'bg-white/10')} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map(c => (
          <div key={c.label} className={cn('flex items-center gap-1.5 text-xs', c.valid ? 'text-emerald-400' : 'text-zinc-500')}>
            {c.valid ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {c.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Change Password Dialog ────────────────────────────────────────────────────
function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const isStrong = next.length >= 8 && /[A-Z]/.test(next) && /[a-z]/.test(next) && /[0-9]/.test(next);
  const isValid = isStrong && next === confirm && !!current;
  const handleClose = () => { setCurrent(''); setNext(''); setConfirm(''); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify.success('Senha Alterada!', 'Sua senha foi atualizada com sucesso.');
      handleClose();
    } catch (err) {
      notify.error('Erro', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-zinc-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Alterar Senha</DialogTitle>
          <DialogDescription className="text-zinc-400">Use uma senha forte e única para sua conta.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Senha Atual</Label>
            <Input type="password" value={current} onChange={e => setCurrent(e.target.value)}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Nova Senha</Label>
            <Input type="password" value={next} onChange={e => setNext(e.target.value)}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50" placeholder="••••••••" />
            {next.length > 0 && <PasswordStrengthBar password={next} />}
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Confirmar Nova Senha</Label>
            <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50" placeholder="••••••••" />
            {confirm.length > 0 && next !== confirm && (
              <p className="text-xs text-red-400 flex items-center gap-1"><XCircle className="h-3 w-3" /> Senhas não coincidem</p>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} className="text-zinc-400 hover:text-white">Cancelar</Button>
            <Button type="submit" disabled={saving || !isValid} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar Senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Change Email Dialog ───────────────────────────────────────────────────────
function ChangeEmailDialog({ open, onClose, currentEmail }: { open: boolean; onClose: () => void; currentEmail: string }) {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const handleClose = () => { setNewEmail(''); setPassword(''); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !password) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_email', newEmail, currentPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      notify.success('E-mail Alterado!', 'Faça login novamente com o novo e-mail.');
      handleClose();
      setTimeout(() => signOut({ callbackUrl: '/login', redirect: true }), 1500);
    } catch (err) {
      notify.error('Erro', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-zinc-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Alterar E-mail</DialogTitle>
          <DialogDescription className="text-zinc-400">E-mail atual: <strong className="text-white">{currentEmail}</strong></DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Novo E-mail</Label>
            <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600" placeholder="novo@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300 text-xs">Confirme sua Senha Atual</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600" placeholder="••••••••" />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={handleClose} className="text-zinc-400 hover:text-white">Cancelar</Button>
            <Button type="submit" disabled={saving || !newEmail || !password} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar E-mail'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, iconBg, iconColor, label, value, action }: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  label: string; value: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('p-1.5 rounded-lg', iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <div>
          <p className="text-xs text-zinc-400">{label}</p>
          <div className="text-sm text-white font-medium">{value}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const { session } = useSession();
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = session?.userData?.name || 'Utilizador';
  const userEmail = session?.userData?.email || '';
  const userRole = session?.userData?.role || '';
  const initials = userName.substring(0, 2).toUpperCase();

  // Form state
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwDialog, setPwDialog] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (session?.userData) {
      setName(session.userData.name || '');
    }
  }, [session]);

  // Save profile info
  const handleSaveProfile = async () => {
    if (!name.trim()) { notify.error('Erro', 'O nome não pode estar vazio.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');
      notify.success('Perfil Atualizado!', `Nome alterado para "${name.trim()}" com sucesso.`);
    } catch (err) {
      notify.error('Erro', (err as Error).message || 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  // Avatar upload (to /api/v1/media for file upload)
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Upload
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/media/upload-avatar', { method: 'POST', body: form });
      if (res.ok) {
        const { url } = await res.json();
        await fetch('/api/v1/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_profile', avatarUrl: url }),
        });
        notify.success('Foto Atualizada!', 'Sua foto de perfil foi salva.');
      } else {
        notify.error('Erro', 'Falha ao enviar imagem. Tente novamente.');
      }
    } catch {
      notify.error('Erro', 'Não foi possível fazer upload da imagem.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await signOut({ callbackUrl: '/login', redirect: true });
    } catch {
      router.push('/login');
    }
  };

  const btnBase = 'h-7 text-xs border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-white/20';

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Meu Perfil" description="Gerencie suas informações pessoais e configurações de segurança." icon={User} />

      {/* ── Avatar + Identity ── */}
      <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
        <div className="relative p-6 flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <Avatar className="h-24 w-24 ring-2 ring-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <AvatarImage src={avatarPreview || session?.userData?.avatarUrl || ''} alt={userName} />
              <AvatarFallback className="text-2xl font-black bg-emerald-500/20 text-emerald-400">{initials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:cursor-not-allowed"
            >
              {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div className="flex-1 text-center sm:text-left pb-1">
            <h2 className="text-xl font-black text-white tracking-tight">{userName}</h2>
            <p className="text-zinc-400 text-sm mt-0.5">{userEmail}</p>
            <Badge className="mt-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs uppercase tracking-widest font-semibold">{userRole}</Badge>
          </div>
        </div>
      </div>

      {/* ── Informações Pessoais ── */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-emerald-500/10"><User className="h-5 w-5 text-emerald-400" /></div>
          <div>
            <h3 className="text-white font-bold text-sm">Informações Pessoais</h3>
            <p className="text-zinc-500 text-xs">Edite seus dados públicos de identificação</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-xs flex items-center gap-1.5"><AtSign className="h-3 w-3" />Nome Completo</Label>
              <Input value={name} onChange={e => setName(e.target.value)}
                className="bg-white/[0.05] border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500/50"
                placeholder="Seu nome completo" />
            </div>
            {/* Campos adicionais como Telefone, Bio e Fuso Horário foram temporariamente removidos pois não possuem integração com o DB. */}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Salvando...' : 'Salvar Informações'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Segurança ── */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-emerald-500/10"><ShieldCheck className="h-5 w-5 text-emerald-400" /></div>
          <div>
            <h3 className="text-white font-bold text-sm">Segurança</h3>
            <p className="text-zinc-500 text-xs">Mantenha sua conta protegida</p>
          </div>
        </div>
        <div className="space-y-3">
          <InfoRow icon={Mail} iconBg="bg-blue-500/10" iconColor="text-blue-400" label="E-mail" value={userEmail}
            action={
              <Button size="sm" variant="outline" onClick={() => setEmailDialog(true)} className={btnBase}>
                Alterar
              </Button>
            }
          />
          <InfoRow icon={Lock} iconBg="bg-amber-500/10" iconColor="text-amber-400" label="Senha" value="••••••••••••"
            action={
              <Button size="sm" variant="outline" onClick={() => setPwDialog(true)} className={btnBase}>
                Alterar
              </Button>
            }
          />
        </div>
      </div>

      {/* ── Encerrar Sessão ── */}
      <div className="rounded-2xl bg-red-500/[0.03] border border-red-500/10 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10"><LogOut className="h-5 w-5 text-red-400" /></div>
            <div>
              <h3 className="text-white font-bold text-sm">Encerrar Sessão</h3>
              <p className="text-zinc-500 text-xs">Você será redirecionado para a tela de login</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} disabled={loggingOut}
            className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 bg-transparent">
            {loggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            {loggingOut ? 'Saindo...' : 'Sair da Conta'}
          </Button>
        </div>
      </div>

      <ChangePasswordDialog open={pwDialog} onClose={() => setPwDialog(false)} />
      <ChangeEmailDialog open={emailDialog} onClose={() => setEmailDialog(false)} currentEmail={userEmail} />
    </div>
  );
}
