// src/app/api/v1/ia/personas/[personaId]/sections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromSession } from '@/app/actions';
import { db } from '@/lib/db';
import { aiPersonas, personaPromptSections } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { personaId } = await params;

    const persona = await db
      .select()
      .from(aiPersonas)
      .where(
        and(
          eq(aiPersonas.id, personaId),
          eq(aiPersonas.companyId, companyId)
        )
      )
      .limit(1);

    if (!persona.length) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    const sections = await db
      .select()
      .from(personaPromptSections)
      .where(eq(personaPromptSections.personaId, personaId))
      .orderBy(desc(personaPromptSections.priority));

    return NextResponse.json(sections);
  } catch (error) {
    console.error('Erro ao buscar seções:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar seções' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    const { personaId } = await params;

    const persona = await db
      .select()
      .from(aiPersonas)
      .where(
        and(
          eq(aiPersonas.id, personaId),
          eq(aiPersonas.companyId, companyId)
        )
      )
      .limit(1);

    if (!persona.length) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    const body = await request.json();
    const { sectionName, content, language, priority, tags } = body;

    if (!sectionName || !content) {
      return NextResponse.json(
        { error: 'Nome e conteúdo são obrigatórios' },
        { status: 400 }
      );
    }

    const [newSection] = await db
      .insert(personaPromptSections)
      .values({
        personaId,
        sectionName,
        content,
        language: language || 'all',
        priority: priority || 0,
        tags: tags || [],
        isActive: true,
      })
      .returning();

    return NextResponse.json(newSection, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar seção:', error);
    return NextResponse.json(
      { error: 'Erro ao criar seção' },
      { status: 500 }
    );
  }
}
