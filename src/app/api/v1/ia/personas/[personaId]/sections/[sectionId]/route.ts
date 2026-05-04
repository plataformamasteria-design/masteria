// src/app/api/v1/ia/personas/[personaId]/sections/[sectionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { aiPersonas, personaPromptSections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string; sectionId: string }> }
) {
  try {
    const session = await getUserSession();
    if (session.error || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const user = session.user;
    
    if (!user.companyId) {
      return NextResponse.json({ error: 'Usuário sem empresa associada' }, { status: 400 });
    }

    const { personaId, sectionId } = await params;

    const persona = await db
      .select()
      .from(aiPersonas)
      .where(
        and(
          eq(aiPersonas.id, personaId),
          eq(aiPersonas.companyId, user.companyId)
        )
      )
      .limit(1);

    if (!persona.length) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    const existingSection = await db
      .select()
      .from(personaPromptSections)
      .where(
        and(
          eq(personaPromptSections.id, sectionId),
          eq(personaPromptSections.personaId, personaId)
        )
      )
      .limit(1);

    if (!existingSection.length || !existingSection[0]) {
      return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 });
    }
    
    const section = existingSection[0];

    const body = await request.json();
    const { sectionName, content, language, priority, tags } = body;

    const [updatedSection] = await db
      .update(personaPromptSections)
      .set({
        sectionName: sectionName || section.sectionName,
        content: content || section.content,
        language: language || section.language,
        priority: priority !== undefined ? priority : section.priority,
        tags: tags !== undefined ? tags : section.tags,
        updatedAt: new Date(),
      })
      .where(eq(personaPromptSections.id, sectionId))
      .returning();

    return NextResponse.json(updatedSection);
  } catch (error) {
    console.error('Erro ao atualizar seção:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar seção' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ personaId: string; sectionId: string }> }
) {
  try {
    const session = await getUserSession();
    if (session.error || !session.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const user = session.user;
    
    if (!user.companyId) {
      return NextResponse.json({ error: 'Usuário sem empresa associada' }, { status: 400 });
    }

    const { personaId, sectionId } = await params;

    const persona = await db
      .select()
      .from(aiPersonas)
      .where(
        and(
          eq(aiPersonas.id, personaId),
          eq(aiPersonas.companyId, user.companyId)
        )
      )
      .limit(1);

    if (!persona.length) {
      return NextResponse.json({ error: 'Agente não encontrado' }, { status: 404 });
    }

    const existingSection = await db
      .select()
      .from(personaPromptSections)
      .where(
        and(
          eq(personaPromptSections.id, sectionId),
          eq(personaPromptSections.personaId, personaId)
        )
      )
      .limit(1);

    if (!existingSection.length) {
      return NextResponse.json({ error: 'Seção não encontrada' }, { status: 404 });
    }

    await db
      .delete(personaPromptSections)
      .where(eq(personaPromptSections.id, sectionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar seção:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar seção' },
      { status: 500 }
    );
  }
}
