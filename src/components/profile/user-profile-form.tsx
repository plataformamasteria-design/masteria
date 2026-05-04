
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { createToastNotifier } from '@/lib/toast-helper';
import { useRouter } from 'next/navigation';
import { useSession } from '@/contexts/session-context';
import { useState, useMemo } from 'react';

export function UserProfileForm(): JSX.Element {
  const { toast } = useToast();
  const notify = useMemo(() => createToastNotifier(toast), [toast]);
  const router = useRouter();
  const { session } = useSession();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  const handleSaveChanges = (): void => {
    notify.success('Perfil Atualizado!', 'Suas informações foram salvas com sucesso.');
  };

  const handleLogout = (): void => {
     router.push('/login');
  }

  return (
    <div className="space-y-8">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Meu Perfil</CardTitle>
          <CardDescription>
            Atualize suas informações pessoais aqui.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Avatar</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="" alt="Avatar" data-ai-hint="avatar user"/>
                <AvatarFallback>{session?.userData?.name?.substring(0,2) || 'U'}</AvatarFallback>
              </Avatar>
              <Input id="avatar-upload" type="file" className="max-w-xs" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="full-name">Nome Completo</Label>
            <Input id="full-name" defaultValue={session?.userData?.name || ''} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={session?.userData?.email || ''} disabled />
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
          <Button variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>Alterar Senha</Button>
          <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Alterar a sua Senha</DialogTitle>
                <DialogDescription>
                  Recomendamos usar uma senha forte que você não usa em outro lugar.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setIsPasswordDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Atualizar Senha</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preferências da Interface</CardTitle>
          <CardDescription>
            Personalize a aparência e o idioma do Master IA.
          </CardDescription>
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
    </div>
  );
}
