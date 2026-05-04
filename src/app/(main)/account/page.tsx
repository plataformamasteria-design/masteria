
import { UserProfileForm } from '@/components/profile/user-profile-form';
import { PageHeader } from '@/components/page-header';
import { FacebookPermissionsSettings } from '@/components/account/facebook-permissions-settings';

export default function AccountPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Minha Conta"
        description="Gerencie suas informações pessoais, de segurança e configurações globais da conta."
      />
      <UserProfileForm />

      <div className="pt-8 border-t">
        <h2 className="text-xl font-semibold mb-4">Sessão Reservada (Permissões de Aplicativos)</h2>
        {/* @ts-ignore */}
        <FacebookPermissionsSettings />
      </div>
    </div>
  );
}
