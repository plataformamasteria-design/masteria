import { db } from '@/lib/db';
import { connections, messageTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from './crypto';

const FACEBOOK_API_VERSION = process.env.FACEBOOK_API_VERSION || 'v24.0';

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
  }>;
}

interface _CreateTemplatePayload {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: MetaTemplateComponent[];
  allow_category_change?: boolean;
}

interface SubmitTemplateResult {
  success: boolean;
  metaTemplateId?: string;
  status?: string;
  error?: string;
  errorDetails?: any;
}

export async function submitTemplateToMeta(
  templateId: string
): Promise<SubmitTemplateResult> {
  try {
    console.log(`[META SERVICE] 🔍 Buscando template no DB: ${templateId}`);

    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, templateId));

    if (!template) {
      console.log('[META SERVICE] ❌ Template não encontrado no DB');
      return {
        success: false,
        error: 'Template não encontrado',
      };
    }

    console.log(`[META SERVICE] ✅ Template encontrado: ${template.name}`);

    if (template.status !== 'DRAFT' && template.status !== 'REJECTED') {
      console.log(`[META SERVICE] ❌ Status inválido: ${template.status}`);
      return {
        success: false,
        error: `Template não pode ser submetido. Status atual: ${template.status}`,
      };
    }

    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, template.connectionId));

    if (!connection) {
      return {
        success: false,
        error: 'Conexão não encontrada',
      };
    }

    if (!connection.accessToken) {
      return {
        success: false,
        error: 'Token de acesso ausente na conexão',
      };
    }

    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
      return {
        success: false,
        error: 'Falha ao desencriptar token de acesso',
      };
    }

    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${template.wabaId}/message_templates`;

    const rawComponents = template.components as MetaTemplateComponent[];

    const validComponents = rawComponents
      .filter(comp => {
        if (comp.type === 'FOOTER' && (!comp.text || comp.text.trim() === '')) {
          return false;
        }
        if (comp.type === 'HEADER' && comp.format === 'TEXT' && (!comp.text || comp.text.trim() === '')) {
          return false;
        }
        return true;
      })
      .map(comp => {
        const component: any = {
          type: comp.type,
        };

        if (comp.format) {
          component.format = comp.format;
        }

        if (comp.text !== undefined) {
          component.text = comp.text;
        }

        // Auto-gerar example values para variáveis (requerido pela Meta API)
        if (comp.type === 'BODY' && comp.text) {
          const vars = comp.text.match(/\{\{\d+\}\}/g);
          if (vars && vars.length > 0) {
            component.example = {
              body_text: [vars.map((_, i) => `exemplo_${i + 1}`)],
            };
          }
        } else if (comp.type === 'HEADER' && comp.format === 'TEXT' && comp.text) {
          const vars = comp.text.match(/\{\{\d+\}\}/g);
          if (vars && vars.length > 0) {
            component.example = {
              header_text: vars.map((_, i) => `exemplo_${i + 1}`),
            };
          }
        } else if (comp.example) {
          component.example = comp.example;
        }

        if (comp.buttons) {
          component.buttons = comp.buttons;
        }

        return component;
      });

    const payload: any = {
      name: template.name,
      language: template.language,
      category: template.category as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION',
      components: validComponents,
      allow_category_change: template.allowCategoryChange ?? true,
    };

    console.log('[META SERVICE] 📤 Enviando para Meta API...');
    console.log('[META SERVICE] 📋 URL:', url);
    console.log('[META SERVICE] 📋 Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000), // Timeout de 15s
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.log('[META SERVICE] ❌ Erro da Meta API:');
      console.log('[META SERVICE] Status:', response.status, response.statusText);
      console.log('[META SERVICE] Response:', JSON.stringify(responseData, null, 2));

      await db
        .update(messageTemplates)
        .set({
          status: 'REJECTED',
          rejectedReason: responseData.error?.message || 'Erro desconhecido',
          updatedAt: new Date(),
        })
        .where(eq(messageTemplates.id, templateId));

      return {
        success: false,
        error: responseData.error?.message || 'Falha ao submeter template',
        errorDetails: responseData.error,
      };
    }

    const metaTemplateId = responseData.id;
    const status = responseData.status || 'PENDING';

    await db
      .update(messageTemplates)
      .set({
        metaTemplateId,
        status,
        submittedAt: new Date(),
        approvedAt: status === 'APPROVED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, templateId));

    return {
      success: true,
      metaTemplateId,
      status,
    };
  } catch (error) {
    console.error('[Meta Templates] Erro ao submeter template:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function getTemplateStatus(
  metaTemplateId: string,
  wabaId: string,
  accessToken: string
): Promise<{ status: string; rejectedReason?: string } | null> {
  try {
    const url = `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${metaTemplateId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000), // Timeout de 15s
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      status: data.status,
      rejectedReason: data.rejected_reason,
    };
  } catch (error) {
    console.error('[Meta Templates] Erro ao buscar status:', error);
    return null;
  }
}

export async function syncTemplateStatus(
  templateId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const [template] = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, templateId));

    if (!template || !template.metaTemplateId) {
      return {
        success: false,
        error: 'Template não encontrado ou não submetido à Meta',
      };
    }

    const [connection] = await db
      .select()
      .from(connections)
      .where(eq(connections.id, template.connectionId));

    if (!connection) {
      return {
        success: false,
        error: 'Conexão não encontrada',
      };
    }

    if (!connection.accessToken) {
      return {
        success: false,
        error: 'Token de acesso ausente na conexão',
      };
    }

    const accessToken = decrypt(connection.accessToken);
    if (!accessToken) {
      return {
        success: false,
        error: 'Falha ao desencriptar token',
      };
    }

    const statusData = await getTemplateStatus(
      template.metaTemplateId,
      template.wabaId,
      accessToken
    );

    if (!statusData) {
      return {
        success: false,
        error: 'Falha ao buscar status na Meta',
      };
    }

    await db
      .update(messageTemplates)
      .set({
        status: statusData.status,
        rejectedReason: statusData.rejectedReason,
        approvedAt: statusData.status === 'APPROVED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(messageTemplates.id, templateId));

    return {
      success: true,
      status: statusData.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
