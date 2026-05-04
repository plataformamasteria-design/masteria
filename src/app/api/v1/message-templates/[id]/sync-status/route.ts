import { NextResponse, type NextRequest } from 'next/server';
import { getUserSession } from '@/app/actions';
import { syncTemplateStatus } from '@/lib/metaTemplatesService';
import { db } from '@/lib/db';
import { messageTemplates } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiCache } from '@/lib/api-cache';


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getUserSession();
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { id: templateId } = await params;
    console.log(`[Sync Template Status API] 🔍 templateId recebido: ${templateId}`);

    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.id, templateId),
          eq(messageTemplates.companyId, user.companyId)
        )
      );

    if (!template) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    const result = await syncTemplateStatus(templateId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
        },
        { status: 400 }
      );
    }

    const [updatedTemplate] = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, templateId));

    // Invalidar cache para atualizar o status na listagem
    apiCache.invalidatePattern('message-templates');

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      status: result.status,
    });
  } catch (error) {
    console.error('[Sync Template Status API] Erro ao sincronizar status:', error);
    return NextResponse.json(
      { error: 'Erro ao sincronizar status' },
      { status: 500 }
    );
  }
}
