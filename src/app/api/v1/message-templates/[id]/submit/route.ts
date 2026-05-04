import { NextResponse, type NextRequest } from 'next/server';
import { getUserSession } from '@/app/actions';
import { submitTemplateToMeta } from '@/lib/metaTemplatesService';
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
    console.log(`[Submit Template API] 🔍 templateId recebido: ${templateId}`);

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

    if (template.status !== 'DRAFT' && template.status !== 'REJECTED') {
      return NextResponse.json(
        {
          error: `Template não pode ser submetido. Status atual: ${template.status}`,
        },
        { status: 400 }
      );
    }

    const result = await submitTemplateToMeta(templateId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.errorDetails,
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
      metaTemplateId: result.metaTemplateId,
      status: result.status,
    });
  } catch (error) {
    console.error('[Submit Template API] Erro ao submeter template:', error);
    return NextResponse.json(
      { error: 'Erro ao submeter template' },
      { status: 500 }
    );
  }
}
