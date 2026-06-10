import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { customMessageTemplates, customTemplateCategories } from '@/lib/db/schema';
import { eq, and, desc, sql, or, ilike, isNull } from 'drizzle-orm';
import { requireCompanyIdOr401 } from '@/lib/api-auth-helper';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';

// Pagination limit constants
const MAX_LIMIT = 50; // Maximum records per request to prevent performance issues
const DEFAULT_LIMIT = 20;

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  content: z.string().min(1, 'Conteúdo é obrigatório'),
  categoryId: z.string().optional().nullable(),
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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCompanyIdOr401();
    if (authResult instanceof NextResponse) {
      return authResult; // Retorna 401 se não autenticado
    }
    const { companyId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    // Enforce maximum limit to prevent performance issues
    const requestedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT));
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const offset = (page - 1) * limit;

    const whereConditions = [
      eq(customMessageTemplates.companyId, companyId),
      eq(customMessageTemplates.active, true),
    ];

    if (search) {
      whereConditions.push(
        or(
          ilike(customMessageTemplates.name, `%${search}%`),
          ilike(customMessageTemplates.content, `%${search}%`)
        )!
      );
    }

    if (categoryId === 'uncategorized') {
      whereConditions.push(isNull(customMessageTemplates.categoryId));
    } else if (categoryId) {
      whereConditions.push(eq(customMessageTemplates.categoryId, categoryId));
    }

    const [templates, totalResult] = await Promise.all([
      db.query.customMessageTemplates.findMany({
        where: and(...whereConditions),
        with: {
          category: true,
        },
        orderBy: [desc(customMessageTemplates.updatedAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customMessageTemplates)
        .where(and(...whereConditions)),
    ]);

    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      data: templates,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    // Se já é uma resposta NextResponse (401), retorna diretamente
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[Templates] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar templates' },
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
    const validation = createTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Dados inválidos',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, content, categoryId } = validation.data;

    if (categoryId) {
      const categoryExists = await db.query.customTemplateCategories.findFirst({
        where: and(
          eq(customTemplateCategories.id, categoryId),
          eq(customTemplateCategories.companyId, companyId)
        ),
      });

      if (!categoryExists) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 400 });
      }
    }

    const variables = extractVariables(content);

    const [newTemplate] = await db
      .insert(customMessageTemplates)
      .values({
        companyId,
        name,
        content,
        categoryId: categoryId || null,
        variables,
        isPredefined: false,
        active: true,
        usageCount: 0,
      })
      .returning();

    if (!newTemplate) {
      return NextResponse.json(
        { error: 'Erro ao criar template' },
        { status: 500 }
      );
    }

    // SECURITY: Validar tenant ao buscar template criado (já criado com companyId, mas garantindo segurança)
    const templateWithCategory = await db.query.customMessageTemplates.findFirst({
      where: and(
        eq(customMessageTemplates.id, newTemplate.id),
        eq(customMessageTemplates.companyId, companyId)
      ),
      with: {
        category: true,
      },
    });

    return NextResponse.json(templateWithCategory, { status: 201 });
  } catch (error) {
    // Se já é uma resposta NextResponse (401), retorna diretamente
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('[Templates] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar template' },
      { status: 500 }
    );
  }
}
