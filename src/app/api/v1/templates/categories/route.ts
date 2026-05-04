import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customTemplateCategories } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  description: z.string().optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const categories = await db.query.customTemplateCategories.findMany({
      where: eq(customTemplateCategories.companyId, companyId),
      with: {
        templates: {
          where: (templates, { eq }) => eq(templates.active, true),
        },
      },
      orderBy: [desc(customTemplateCategories.createdAt)],
    });

    const categoriesWithCount = categories.map((category) => ({
      ...category,
      templateCount: category.templates.length,
      templates: undefined,
    }));

    return NextResponse.json({ data: categoriesWithCount });
  } catch (error) {
    console.error('[Template Categories] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar categorias' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = createCategorySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, description, icon } = validation.data;

    const existingCategory = await db.query.customTemplateCategories.findFirst({
      where: and(
        eq(customTemplateCategories.companyId, companyId),
        eq(customTemplateCategories.name, name)
      ),
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Já existe uma categoria com este nome' },
        { status: 409 }
      );
    }

    const [newCategory] = await db
      .insert(customTemplateCategories)
      .values({
        companyId,
        name,
        description: description || null,
        icon: icon || null,
      })
      .returning();

    return NextResponse.json({ ...newCategory, templateCount: 0 }, { status: 201 });
  } catch (error) {
    console.error('[Template Categories] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar categoria' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('id');

    if (!categoryId) {
      return NextResponse.json({ error: 'ID da categoria é obrigatório' }, { status: 400 });
    }

    const existing = await db.query.customTemplateCategories.findFirst({
      where: and(
        eq(customTemplateCategories.id, categoryId),
        eq(customTemplateCategories.companyId, companyId)
      ),
      with: {
        templates: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
    }

    if (existing.templates.length > 0) {
      return NextResponse.json(
        {
          error: 'Não é possível deletar categoria com templates associados',
          templateCount: existing.templates.length,
        },
        { status: 409 }
      );
    }

    await db
      .delete(customTemplateCategories)
      .where(
        and(
          eq(customTemplateCategories.id, categoryId),
          eq(customTemplateCategories.companyId, companyId)
        )
      );

    return NextResponse.json({ success: true, message: 'Categoria deletada com sucesso' });
  } catch (error) {
    console.error('[Template Categories] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao deletar categoria' },
      { status: 500 }
    );
  }
}
