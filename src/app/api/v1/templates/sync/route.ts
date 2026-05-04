// src/app/api/v1/templates/sync/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq, and, notInArray } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import { getCompanyIdFromSession } from '@/app/actions';
import { apiCache } from '@/lib/api-cache';

export const dynamic = 'force-dynamic';

// Esta é uma definição de tipo simplificada para a resposta da API da Meta.
type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    text?: string;
    format?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'TEXT';
    example?: any;
  }[];
};

async function fetchTemplatesFromMeta(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
  const url = `https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=500`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json() as unknown;
      console.error(`Meta API Error for WABA ${wabaId}:`, errorData);
      throw new Error((errorData as any)?.error.message || 'Falha ao buscar modelos da Meta.');
    }

    const data = await response.json() as { data: MetaTemplate[] };
    return data.data || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao buscar templates da Meta (30s)');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(_request: NextRequest) {
  console.log('🔵 Iniciando sincronização de modelos...');
  let totalSynced = 0;
  let totalDeleted = 0;
  let totalFailed = 0;

  try {
    const companyId = await getCompanyIdFromSession();
    const activeConnections = await db
      .select()
      .from(connections)
      .where(and(eq(connections.isActive, true), eq(connections.companyId, companyId)));

    if (activeConnections.length === 0) {
      return NextResponse.json({ message: 'Nenhuma conexão ativa encontrada para sincronizar.' });
    }

    // Process WABAs uniquely to avoid redundant API calls
    const uniqueWabas = Array.from(new Map(activeConnections.map(c => [c.wabaId, c])).values());

    for (const conn of uniqueWabas) {
      try {
        if (!conn.wabaId) {
          console.warn(`Conexão ${conn.config_name} não possui WABA ID. Pulando sincronização.`);
          continue;
        }

        if (!conn.accessToken) {
          throw new Error(`Token de acesso ausente para a conexão associada à WABA ${conn.wabaId}`);
        }
        const decryptedToken = decrypt(conn.accessToken);
        if (!decryptedToken) {
          throw new Error(`Falha ao desencriptar token para a conexão associada à WABA ${conn.wabaId}`);
        }

        const metaTemplates = await fetchTemplatesFromMeta(conn.wabaId, decryptedToken);
        const metaTemplateIds = metaTemplates.map(t => t.id);

        // --- Lógica de Deleção ---
        // SECURITY: Validar tenant - connection já foi validado acima (companyId)
        const deletionConditions = [
          eq(messageTemplates.wabaId, conn.wabaId),
          eq(messageTemplates.connectionId, conn.id),
          eq(messageTemplates.companyId, companyId), // Garantir tenant
        ];
        if (metaTemplateIds.length > 0) {
          deletionConditions.push(notInArray(messageTemplates.metaTemplateId, metaTemplateIds));
        }

        const deleted = await db.delete(messageTemplates)
          .where(and(...deletionConditions))
          .returning({ id: messageTemplates.id });

        totalDeleted += deleted.length;

        // --- Lógica de UPSERT ---
        if (metaTemplates.length > 0) {
          for (const metaTpl of metaTemplates) {
            const templateData = {
              companyId: companyId,
              connectionId: conn.id,
              wabaId: conn.wabaId,
              name: metaTpl.name,
              displayName: metaTpl.name,
              language: metaTpl.language,
              category: metaTpl.category,
              status: metaTpl.status,
              metaTemplateId: metaTpl.id,
              components: metaTpl.components as any,
              updatedAt: new Date(),
            };

            await db.insert(messageTemplates)
              .values(templateData)
              .onConflictDoUpdate({
                target: [messageTemplates.name, messageTemplates.wabaId],
                set: {
                  ...templateData,
                  id: undefined,
                  createdAt: undefined,
                },
              });

            totalSynced++;
          }
        }
      } catch (error) {
        console.error(`Falha ao sincronizar templates para a WABA ${conn.wabaId}:`, error);
        totalFailed++;
      }
    }

    const summaryMessage = `${totalSynced} modelos foram atualizados/criados e ${totalDeleted} modelos obsoletos foram removidos.`;
    console.log(`✅ Sincronização concluída. ${summaryMessage}`);

    // Invalidar cache para que a listagem reflita os status atualizados
    apiCache.invalidatePattern('message-templates');

    return NextResponse.json({ success: true, message: summaryMessage, synced: totalSynced, deleted: totalDeleted, failedConnections: totalFailed });

  } catch (error) {
    console.error('Erro geral no endpoint de sincronização:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor.';
    return NextResponse.json({ error: errorMessage, details: (error as Error).stack }, { status: 500 });
  }
}
