import { useState, useEffect, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Lock, Image as ImageIcon, Moon, Sun, Volume2, VolumeX, PenLine, Users, Palette, Building2, Settings, Eye, EyeOff, Globe } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAudioNotifications } from "@/hooks/useAudioNotifications";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrgColorSettings } from "@/components/organizations/OrgColorSettings";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useOrganizations } from "@/hooks/useOrganizations";
import { usePagePermissions } from "@/hooks/usePagePermissions";
import UsersContent from "@/components/settings/UsersContent";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type LanguageCode } from "@/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleConnectionSettings } from "@/components/organizations/GoogleConnectionSettings";
import { GHLConnectionSettings } from "@/components/organizations/GHLConnectionSettings";
import { MetaConnectionSettings } from "@/components/developer/MetaConnectionSettings";
import { MarketingMetaSettings } from "@/components/organizations/MarketingMetaSettings";
import { WaCloudSettings } from "@/components/organizations/WaCloudSettings";
import { Facebook, Chrome, Link2, LayoutGrid, BarChart3, MessageCircle } from "lucide-react";


interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  message_signature_enabled?: boolean;
  show_team_assigned_chats?: boolean;
}

const Profile = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [messageSignatureEnabled, setMessageSignatureEnabled] = useState(true);
  const [showTeamAssignedChats, setShowTeamAssignedChats] = useState(false);
  const [showAllTabs, setShowAllTabs] = useState(() => localStorage.getItem('show_all_tabs') === 'true');
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { audioEnabled, toggleAudio } = useAudioNotifications();
  const { currentOrganization, isSuperAdmin, refreshOrganizations } = useOrganization();
  const { updateOrganization } = useOrganizations();
  const { isAdmin, isSubAdmin, permissions } = usePagePermissions();
  const { t, i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(i18n.language as LanguageCode || 'pt');

  // Organization info state
  const [orgName, setOrgName] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgPhone, setOrgPhone] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const canManageOrg = isSuperAdmin || isAdmin;
  const canManageUsers = isSuperAdmin || isAdmin || isSubAdmin || permissions.includes('users');

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name || "");
      const settings = (currentOrganization.settings || {}) as Record<string, any>;
      setOrgEmail(settings.email || "");
      setOrgPhone(settings.phone || "");
      setOrgLogoUrl(settings.logo_url || "");
    }
  }, [currentOrganization]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profileData } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile({
          id: user.id,
          email: user.email || '',
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          message_signature_enabled: profileData.message_signature_enabled ?? true,
          show_team_assigned_chats: profileData.show_team_assigned_chats ?? false,
        });
        setFullName(profileData.full_name || '');
        setNewEmail(user.email || '');
        setMessageSignatureEnabled(profileData.message_signature_enabled ?? true);
        setShowTeamAssignedChats(profileData.show_team_assigned_chats ?? false);
        // Load saved language
        if (profileData.preferred_language) {
          setSelectedLanguage(profileData.preferred_language);
          i18n.changeLanguage(profileData.preferred_language);
          localStorage.setItem('user_language', profileData.preferred_language);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar seus dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMessageSignature = async (enabled: boolean) => {
    try {
      if (!profile) return;
      setMessageSignatureEnabled(enabled);
      const { error } = await (supabase.from('profiles') as any)
        .update({ message_signature_enabled: enabled })
        .eq('id', profile.id);
      if (error) throw error;
      toast({
        title: 'Preferência atualizada',
        description: enabled
          ? 'Assinatura ativada: suas mensagens de texto incluirão seu nome.'
          : 'Assinatura desativada: suas mensagens de texto serão enviadas sem o nome.',
      });
    } catch (error: any) {
      console.error('Error updating message signature:', error);
      toast({ title: 'Erro ao atualizar preferência', description: error.message, variant: 'destructive' });
      await fetchProfile();
    }
  };

  const updateShowTeamAssignedChats = async (enabled: boolean) => {
    try {
      if (!profile) return;
      setShowTeamAssignedChats(enabled);
      const { error } = await (supabase.from('profiles') as any)
        .update({ show_team_assigned_chats: enabled })
        .eq('id', profile.id);
      if (error) throw error;
      toast({
        title: 'Preferência atualizada',
        description: enabled
          ? 'Visualização expandida: conversas atribuídas aparecerão também na aba Equipe.'
          : 'Visualização padrão: conversas atribuídas aparecerão apenas em Minhas.',
      });
    } catch (error: any) {
      console.error('Error updating show_team_assigned_chats:', error);
      toast({ title: 'Erro ao atualizar preferência', description: error.message, variant: 'destructive' });
      await fetchProfile();
    }
  };

  const updateLanguage = async (lang: LanguageCode) => {
    try {
      if (!profile) return;
      setSelectedLanguage(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('user_language', lang);
      const { error } = await (supabase.from('profiles') as any)
        .update({ preferred_language: lang })
        .eq('id', profile.id);
      if (error) throw error;
      toast({
        title: t('toast.languageChanged'),
        description: t('toast.languageChangedDesc'),
      });
    } catch (error: any) {
      console.error('Error updating language:', error);
      toast({ title: t('toast.errorUpdating'), description: error.message, variant: 'destructive' });
    }
  };

  const updateFullName = async () => {
    try {
      if (!profile) return;
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
      if (error) throw error;
      toast({ title: "Nome atualizado", description: "Seu nome foi atualizado com sucesso" });
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast({ title: "Erro ao atualizar nome", description: error.message, variant: "destructive" });
    }
  };

  const updateEmail = async () => {
    try {
      if (!newEmail || newEmail === profile?.email) {
        toast({ title: "Email não alterado", description: "Digite um novo email diferente do atual", variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast({ title: "Email atualizado", description: "Verifique seu novo email para confirmar a alteração" });
      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating email:', error);
      toast({ title: "Erro ao atualizar email", description: error.message, variant: "destructive" });
    }
  };

  const updatePassword = async () => {
    try {
      if (!newPassword || newPassword.length < 6) {
        toast({ title: "Senha inválida", description: "A senha deve ter no mínimo 6 caracteres", variant: "destructive" });
        return;
      }
      if (newPassword !== confirmPassword) {
        toast({ title: "Senhas não coincidem", description: "As senhas digitadas não são iguais", variant: "destructive" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha atualizada", description: "Sua senha foi alterada com sucesso" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrlWithCache = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrlWithCache }).eq('id', profile?.id);
      if (updateError) throw updateError;
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrlWithCache } : null);
      toast({ title: "Avatar atualizado", description: "Sua foto de perfil foi atualizada com sucesso" });
      await fetchProfile();
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveOrgInfo = async () => {
    if (!currentOrganization) return;
    try {
      const currentSettings = (currentOrganization.settings || {}) as Record<string, any>;
      const newSettings = { ...currentSettings, email: orgEmail, phone: orgPhone, logo_url: orgLogoUrl };

      // Update name and settings
      await updateOrganization(currentOrganization.id, { name: orgName, settings: newSettings } as any);
      await refreshOrganizations();
      toast({ title: "Empresa atualizada", description: "As informações da empresa foram salvas" });
    } catch (error: any) {
      console.error('Error saving org info:', error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const uploadOrgLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentOrganization || !event.target.files || event.target.files.length === 0) return;
    try {
      setUploadingLogo(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `org-logos/${currentOrganization.id}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrlWithCache = `${publicUrl}?t=${Date.now()}`;
      setOrgLogoUrl(publicUrlWithCache);

      // Auto-save
      const currentSettings = (currentOrganization.settings || {}) as Record<string, any>;
      const newSettings = { ...currentSettings, logo_url: publicUrlWithCache };
      await updateOrganization(currentOrganization.id, { settings: newSettings } as any);
      await refreshOrganizations();
      toast({ title: "Logo atualizado", description: "O logo da empresa foi atualizado" });
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast({ title: "Erro ao fazer upload", description: error.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AppShell>
    );
  }

  const visibleTabs: string[] = ['profile'];
  if (canManageOrg) visibleTabs.push('empresa');
  if (canManageOrg) visibleTabs.push('integracoes');
  if (canManageUsers) visibleTabs.push('usuarios');
  visibleTabs.push('cores');
  const tabCount = visibleTabs.length;
  const gridClass = tabCount === 2 ? 'grid-cols-2' : tabCount === 3 ? 'grid-cols-3' : tabCount === 4 ? 'grid-cols-4' : 'grid-cols-5';

  return (
    <AppShell>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8">
          {/* Header with Avatar */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-3xl opacity-30 rounded-3xl" />
            <Card className="relative border-0 shadow-2xl bg-gradient-to-br from-card/95 via-card to-card/95 backdrop-blur-xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
                  {/* Avatar */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                    <Avatar key={profile?.avatar_url} className="relative h-24 w-24 md:h-32 md:w-32 ring-4 ring-background shadow-2xl">
                      <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || profile?.email} />
                      <AvatarFallback className="text-3xl md:text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                        {profile?.full_name?.[0] || profile?.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-primary to-accent rounded-full cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-110"
                    >
                      <ImageIcon className="h-4 w-4 text-primary-foreground" />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={uploadAvatar}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* User Info */}
                  <div className="flex-1 text-center md:text-left space-y-2 md:space-y-3">
                    <div>
                      <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent flex items-center justify-center md:justify-start gap-2">
                        <Settings className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                        {t('profile.title')}
                      </h1>
                      <p className="text-muted-foreground mt-1 flex items-center justify-center md:justify-start gap-2">
                        <Mail className="h-4 w-4" />
                        {profile?.email}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {t('profile.subtitle')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue={initialTab} className="w-full">
            <TabsList className={`grid w-full max-w-2xl ${gridClass}`}>
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{t('profile.tabs.profile')}</span>
                <span className="sm:hidden">{t('profile.tabs.profile')}</span>
              </TabsTrigger>
              {canManageOrg && (
                <TabsTrigger value="empresa" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  {t('profile.tabs.company')}
                </TabsTrigger>
              )}
              {canManageUsers && (
                <TabsTrigger value="usuarios" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('profile.tabs.users')}</span>
                  <span className="sm:hidden">{t('profile.tabs.users')}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="cores" className="gap-2">
                <Palette className="h-4 w-4" />
                {t('profile.tabs.colors')}
              </TabsTrigger>
              {canManageOrg && (
                <TabsTrigger value="integracoes" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Integrações
                </TabsTrigger>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 md:space-y-8 mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Personal Information */}
                <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm hover:shadow-2xl transition-all">
                  <CardHeader className="space-y-1 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('profile.personalInfo.title')}</CardTitle>
                    </div>
                    <CardDescription>{t('profile.personalInfo.description')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">{t('profile.personalInfo.fullName')}</Label>
                      <div className="flex gap-2">
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('profile.personalInfo.fullName')} className="bg-background/50" />
                        <Button onClick={updateFullName} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">{t('profile.personalInfo.save')}</Button>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="email" className="text-sm font-medium">{t('profile.personalInfo.email')}</Label>
                      <div className="flex gap-2">
                        <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="seu@email.com" className="bg-background/50" />
                        <Button onClick={updateEmail} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">{t('profile.personalInfo.update')}</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('profile.personalInfo.emailHint')}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Security */}
                <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm hover:shadow-2xl transition-all">
                  <CardHeader className="space-y-1 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                        <Lock className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>{t('profile.security.title')}</CardTitle>
                    </div>
                    <CardDescription>{t('profile.security.description')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword" className="text-sm font-medium">{t('profile.security.newPassword')}</Label>
                      <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('profile.security.newPasswordPlaceholder')} className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-sm font-medium">{t('profile.security.confirmPassword')}</Label>
                      <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('profile.security.confirmPasswordPlaceholder')} className="bg-background/50" />
                    </div>
                    <Button onClick={updatePassword} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">{t('profile.security.changePassword')}</Button>
                  </CardContent>
                </Card>
              </div>

              {/* Preferences */}
              <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm hover:shadow-2xl transition-all">
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>{t('profile.preferences.title')}</CardTitle>
                  </div>
                  <CardDescription>{t('profile.preferences.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t('profile.preferences.teamView')}</p>
                          <p className="text-sm text-muted-foreground">{showTeamAssignedChats ? t('profile.preferences.teamViewEnabled') : t('profile.preferences.teamViewDisabled')}</p>
                        </div>
                      </div>
                      <Switch checked={showTeamAssignedChats} onCheckedChange={updateShowTeamAssignedChats} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                          <PenLine className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t('profile.preferences.messageSignature')}</p>
                          <p className="text-sm text-muted-foreground">{messageSignatureEnabled ? t('profile.preferences.signatureEnabled') : t('profile.preferences.signatureDisabled')}</p>
                        </div>
                      </div>
                      <Switch checked={messageSignatureEnabled} onCheckedChange={updateMessageSignature} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                          {audioEnabled ? <Volume2 className="h-5 w-5 text-primary" /> : <VolumeX className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="font-medium">{t('profile.preferences.audioNotifications')}</p>
                          <p className="text-sm text-muted-foreground">{audioEnabled ? t('profile.preferences.audioEnabled') : t('profile.preferences.audioDisabled')}</p>
                        </div>
                      </div>
                      <Switch checked={audioEnabled} onCheckedChange={toggleAudio} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                          {showAllTabs ? <Eye className="h-5 w-5 text-primary" /> : <EyeOff className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="font-medium">{t('profile.preferences.showAllTabs')}</p>
                          <p className="text-sm text-muted-foreground">
                            {showAllTabs
                              ? t('profile.preferences.showAllTabsEnabled')
                              : t('profile.preferences.showAllTabsDisabled')}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={showAllTabs}
                        onCheckedChange={(val) => {
                          setShowAllTabs(val);
                          localStorage.setItem('show_all_tabs', val ? 'true' : 'false');
                          window.dispatchEvent(new Event('show_all_tabs_changed'));
                        }}
                        className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent"
                      />
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30 hover:from-background/60 hover:to-background/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t('profile.preferences.language')}</p>
                          <p className="text-sm text-muted-foreground">{t('profile.preferences.languageDescription')}</p>
                        </div>
                      </div>
                      <Select value={selectedLanguage} onValueChange={(val) => updateLanguage(val as LanguageCode)}>
                        <SelectTrigger className="w-[180px] bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              <span className="flex items-center gap-2">
                                <span>{lang.flag}</span>
                                <span>{lang.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Empresa Tab */}
            {canManageOrg && (
              <TabsContent value="empresa" className="mt-6 space-y-6">
                <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                  <CardHeader className="space-y-1 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <CardTitle>Informações da Empresa</CardTitle>
                    </div>
                    <CardDescription>Gerencie os dados da sua organização</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Logo */}
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                          <AvatarImage src={orgLogoUrl} alt={orgName} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-2xl font-bold">
                            {orgName?.[0]?.toUpperCase() || 'E'}
                          </AvatarFallback>
                        </Avatar>
                        <label
                          htmlFor="logo-upload"
                          className="absolute bottom-0 right-0 p-1.5 bg-gradient-to-r from-primary to-accent rounded-full cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-110"
                        >
                          <ImageIcon className="h-3 w-3 text-primary-foreground" />
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            onChange={uploadOrgLogo}
                            disabled={uploadingLogo}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <div>
                        <p className="font-medium">Logo da Empresa</p>
                        <p className="text-sm text-muted-foreground">Clique no ícone para alterar</p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome da Empresa</Label>
                        <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nome da empresa" className="bg-background/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input value={currentOrganization?.slug || ""} disabled className="bg-background/30 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="empresa@email.com" type="email" className="bg-background/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Número Registrado</Label>
                        <Input value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-background/50" />
                      </div>
                    </div>

                    {currentOrganization?.plan && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-sm text-muted-foreground">
                          Plano: <span className="font-medium text-primary">
                            {currentOrganization.plan === 'plataforma' ? 'Plataforma' :
                              currentOrganization.plan === 'agente_ia' ? 'Agente I.A' :
                                currentOrganization.plan === 'full_stack' ? 'Full Stack' : currentOrganization.plan}
                          </span>
                        </p>
                      </div>
                    )}

                    <Button onClick={saveOrgInfo} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
                      Salvar Informações
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Usuários Tab */}
            {canManageUsers && (
              <TabsContent value="usuarios" className="mt-6">
                <UsersContent />
              </TabsContent>
            )}

            {/* Cores Tab */}
            <TabsContent value="cores" className="mt-6">
              <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardHeader className="space-y-1 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                      <Palette className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle>Cores do Sistema</CardTitle>
                  </div>
                  <CardDescription>
                    {canManageOrg
                      ? "Personalize as cores da interface para toda a organização"
                      : "As cores são definidas pelo administrador da organização. Você pode escolher entre modo claro e escuro."
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {canManageOrg && currentOrganization ? (
                    <OrgColorSettings
                      settings={currentOrganization.settings || {}}
                      onSave={async (colors) => {
                        const newSettings = { ...(currentOrganization.settings || {}), theme_colors: colors };
                        await updateOrganization(currentOrganization.id, { settings: newSettings } as any);
                        await refreshOrganizations();
                        toast({ title: "Cores atualizadas", description: "As cores do sistema foram salvas com sucesso" });
                      }}
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-background/50 to-background/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg">
                              {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                            </div>
                            <div>
                              <p className="font-medium">Modo Escuro</p>
                              <p className="text-sm text-muted-foreground">{theme === 'dark' ? 'Ativado' : 'Desativado'}</p>
                            </div>
                          </div>
                          <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary data-[state=checked]:to-accent" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Entre em contato com o administrador para personalizar as cores do sistema.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Integrações Tab */}
            {canManageOrg && currentOrganization && (
              <TabsContent value="integracoes" className="mt-6 space-y-6">
                <div className="grid gap-6">
                  {/* GHL Integration */}
                  <GHLConnectionSettings organizationId={currentOrganization.id} />

                  {/* Google Integration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Chrome className="h-5 w-5 text-primary" />
                        Google Meu Negócio & Email
                      </CardTitle>
                      <CardDescription>
                        Conecte Google Meu Negócio e Gmail para automatizar avaliações e comunicações
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <GoogleConnectionSettings />
                    </CardContent>
                  </Card>

                  {/* Facebook & Instagram Integration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Facebook className="h-5 w-5 text-blue-600" />
                        Facebook & Instagram
                      </CardTitle>
                      <CardDescription>
                        Conecte suas páginas para gerenciar mensagens e posts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MetaConnectionSettings />
                    </CardContent>
                  </Card>

                  {/* Marketing Meta Integration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-500" />
                        Meta Marketing (Ads & Insights)
                      </CardTitle>
                      <CardDescription>
                        Configure o Meta App para puxar dados de campanhas, insights de página e perfil Instagram
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <MarketingMetaSettings />
                    </CardContent>
                  </Card>

                  {/* WhatsApp Cloud Integration */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-teal-600" />
                        WhatsApp API Oficial (Cloud)
                      </CardTitle>
                      <CardDescription>
                        Configure os tokens do Meta for Developers para habilitar o envio de Modelos e campanhas na API Oficial
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <WaCloudSettings />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

          </Tabs>
        </div>
      </div>
    </AppShell>
  );
};

export default Profile;
