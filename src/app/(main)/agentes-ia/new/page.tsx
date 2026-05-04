
// src/app/(main)/ia/new/page.tsx
'use client';

import { PageHeader } from '@/components/page-header';
import { PersonaEditor } from '@/components/ia/persona-editor';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPersonaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Criar Novo Agente de IA"
        description="Configure o comportamento e o conhecimento do seu novo assistente virtual."
      >
        <Link href="/agentes-ia" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Agentes
          </Button>
        </Link>
      </PageHeader>

      <PersonaEditor persona={null} />
    </div>
  );
}
