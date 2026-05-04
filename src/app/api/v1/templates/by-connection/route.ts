import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  connectionId: z.string().min(1, 'connectionId obrigatório'),
});

export async function GET(req: Request) {
  try {

    const url = new URL(req.url);
    const connectionId = url.searchParams.get('connectionId');

    const result = querySchema.safeParse({ connectionId });
    if (!result.success) {
      return Response.json(
        { error: result.error?.issues?.[0]?.message || 'Parâmetros inválidos' },
        { status: 400 }
      );
    }

    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, result.data.connectionId));

    if (!connection) {
      return Response.json({ error: 'Conexão não encontrada' }, { status: 404 });
    }

    const templates = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.connectionId, result.data.connectionId));

    return Response.json({
      success: true,
      provider: connection.connectionType,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        displayName: t.displayName || t.name,
        category: t.category,
        language: t.language,
        status: t.status,
      })),
    });
  } catch (error) {
    console.error('[API] Templates by connection:', error);
    return Response.json(
      { error: 'Erro ao carregar templates' },
      { status: 500 }
    );
  }
}
