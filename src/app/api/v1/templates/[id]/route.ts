import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customMessageTemplates, customTemplateCategories } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  incrementUsage: z.boolean().optional(),
});

function extractVariables(content: string): string[] {
  const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const variableName = match[1];
    if (variableName && !variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const existing = await db.query.customMessageTemplates.findFirst({
      where: and(
        eq(customMessageTemplates.id, id),
        eq(customMessageTemplates.companyId, companyId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    if (existing.isPredefined) {
      return NextResponse.json(
        { error: 'Templates predefinidos não podem ser modificados' },
        { status: 403 }
      );
    }

    if (validation.data.categoryId) {
      const categoryExists = await db.query.customTemplateCategories.findFirst({
        where: and(
          eq(customTemplateCategories.id, validation.data.categoryId),
          eq(customTemplateCategories.companyId, companyId)
        ),
      });

      if (!categoryExists) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 });
      }
    }

    const updateData: any = {};
    
    if (validation.data.name !== undefined) {
      updateData.name = validation.data.name;
    }
    
    if (validation.data.content !== undefined) {
      updateData.content = validation.data.content;
      updateData.variables = extractVariables(validation.data.content);
    }
    
    if (validation.data.categoryId !== undefined) {
      updateData.categoryId = validation.data.categoryId;
    }
    
    if (validation.data.active !== undefined) {
      updateData.active = validation.data.active;
    }

    if (validation.data.incrementUsage) {
      updateData.usageCount = sql`${customMessageTemplates.usageCount} + 1`;
    }

    const [updated] = await db
      .update(customMessageTemplates)
      .set(updateData)
      .where(
        and(
          eq(customMessageTemplates.id, id),
          eq(customMessageTemplates.companyId, companyId)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    const templateWithCategory = await db.query.customMessageTemplates.findFirst({
      where: and(
        eq(customMessageTemplates.id, updated.id),
        eq(customMessageTemplates.companyId, companyId)
      ),
      with: {
        category: true,
      },
    });

    return NextResponse.json(templateWithCategory);
  } catch (error) {
    console.error('[Templates] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.query.customMessageTemplates.findFirst({
      where: and(
        eq(customMessageTemplates.id, id),
        eq(customMessageTemplates.companyId, companyId)
      ),
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
    }

    if (existing.isPredefined) {
      return NextResponse.json(
        { error: 'Templates predefinidos não podem ser deletados' },
        { status: 403 }
      );
    }

    await db
      .delete(customMessageTemplates)
      .where(
        and(
          eq(customMessageTemplates.id, id),
          eq(customMessageTemplates.companyId, companyId)
        )
      );

    return NextResponse.json({ success: true, message: 'Template deletado com sucesso' });
  } catch (error) {
    console.error('[Templates] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao deletar template' },
      { status: 500 }
    );
  }
}
