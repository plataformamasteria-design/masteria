import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { PersonaList } from '@/components/ia/persona-list';

export default function AiPersonasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Agentes de IA"
          description="Crie e treine os diferentes agentes de IA para sua empresa."
        />
        <Link href="/agentes-ia/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Criar Novo Agente
          </Button>
        </Link>
      </div>
      
      <PersonaList />
    </div>
  );
}
