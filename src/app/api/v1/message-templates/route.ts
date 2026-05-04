import { NextResponse, type NextRequest } from 'next/server';
import { getUserSession } from '@/app/actions';
import { db } from '@/lib/db';
import { messageTemplates, connections } from '@/lib/db/schema';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { getCachedOrFetch, CacheTTL, apiCache } from '@/lib/api-cache';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { user } = await getUserSession();
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const companyId = user.companyId!;
    const cacheKey = `message-templates:${companyId}:${connectionId || 'all'}:${status || 'all'}:${search || ''}`;

    const templates = await getCachedOrFetch(cacheKey, async () => {
      // CRITICAL: Sempre incluir companyId como filtro base (tenant isolation)
      const conditions: any[] = [eq(messageTemplates.companyId, companyId)];

      if (connectionId) {
        conditions.push(eq(messageTemplates.connectionId, connectionId));
      }

      if (status) {
        conditions.push(eq(messageTemplates.status, status));
      }

      if (search) {
        conditions.push(
          or(
            like(messageTemplates.name, `%${search}%`),
            like(messageTemplates.displayName, `%${search}%`)
          )
        );
      }

      const results = await db
        .select({
          template: messageTemplates,
          connection: connections,
        })
        .from(messageTemplates)
        .leftJoin(connections, eq(messageTemplates.connectionId, connections.id))
        .where(and(...conditions))
        .orderBy(desc(messageTemplates.createdAt));

      return results.map(row => ({
        ...row.template,
        connection: row.connection,
      }));
    }, CacheTTL.CONFIG_STATIC);

    return NextResponse.json(templates);
  } catch (error) {
    console.error('[Message Templates API] Erro ao listar templates:', error);
    return NextResponse.json(
      { error: 'Erro ao listar templates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { user } = await getUserSession();
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, displayName, connectionId, wabaId, category, language, components } = body;

    if (!name || !connectionId || !wabaId || !category || !language || !components) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      );
    }

    const [newTemplate] = await db
      .insert(messageTemplates)
      .values({
        name,
        displayName: displayName || null,
        connectionId,
        wabaId,
        category,
        language,
        components,
        companyId: user.companyId,
        createdBy: user.id,
        status: 'DRAFT',
      })
      .returning();

    // Invalidar cache para que a listagem mostre o novo template imediatamente
    apiCache.invalidatePattern('message-templates');

    return NextResponse.json({
      success: true,
      template: newTemplate,
    });
  } catch (error: any) {
    console.error('[Message Templates API] Erro ao criar template:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um template com este nome para esta conexão' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar template' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await getUserSession();
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, displayName, category, language, components } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID do template é obrigatório' },
        { status: 400 }
      );
    }

    const [existingTemplate] = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.companyId, user.companyId)
        )
      );

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    if (existingTemplate.status !== 'DRAFT' && existingTemplate.status !== 'REJECTED') {
      return NextResponse.json(
        {
          error: 'Apenas templates em DRAFT ou REJECTED podem ser editados',
        },
        { status: 400 }
      );
    }

    const [updatedTemplate] = await db
      .update(messageTemplates)
      .set({
        name: name || existingTemplate.name,
        displayName: displayName !== undefined ? displayName : existingTemplate.displayName,
        category: category || existingTemplate.category,
        language: language || existingTemplate.language,
        components: components || existingTemplate.components,
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, id))
      .returning();

    // Invalidar cache para que a listagem reflita as mudanças
    apiCache.invalidatePattern('message-templates');

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
    });
  } catch (error: any) {
    console.error('[Message Templates API] Erro ao atualizar template:', error);

    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Já existe um template com este nome para esta conexão' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserSession();
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID do template é obrigatório' },
        { status: 400 }
      );
    }

    const [existingTemplate] = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, id),
          eq(messageTemplates.companyId, user.companyId)
        )
      );

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    // SECURITY: Validar tenant ao deletar template (já validado acima, mas garantindo segurança)
    await db.delete(messageTemplates).where(and(
      eq(messageTemplates.id, id),
      eq(messageTemplates.companyId, user.companyId)
    ));

    // Invalidar cache para que a listagem reflita a exclusão
    apiCache.invalidatePattern('message-templates');

    return NextResponse.json({
      success: true,
      message: 'Template deletado com sucesso',
    });
  } catch (error) {
    console.error('[Message Templates API] Erro ao deletar template:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar template' },
      { status: 500 }
    );
  }
}
