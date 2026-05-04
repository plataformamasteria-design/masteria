
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { crmIntegrations, crmAccounts, crmSyncLogs } from '@/lib/db/schema';
import { getCompanyIdFromSession } from '@/app/actions';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto';
import { and, eq } from 'drizzle-orm';

const connectSchema = z.object({
  domain: z.string().url('O domínio deve ser uma URL válida (ex: https://exemplo.kommo.com).'),
  accessToken: z.string().min(1, 'O Access Token é obrigatório.'),
  authType: z.enum(['oauth', 'token']),
});


// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
    let integrationId: string | null = null;
    try {
        const companyId = await getCompanyIdFromSession();
        const body = await request.json();
        const parsed = connectSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ error: 'Dados de conexão inválidos.', details: parsed.error.flatten() }, { status: 400 });
        }
        
        const { domain, accessToken, authType } = parsed.data;

        await db.transaction(async (tx) => {
            let [integration] = await tx.select()
                .from(crmIntegrations)
                .where(and(eq(crmIntegrations.companyId, companyId), eq(crmIntegrations.provider, 'kommo')));
            
            if (integration) {
                // Se a integração já existe, atualize o status para conectado
                const [updatedIntegration] = await tx.update(crmIntegrations)
                    .set({ status: 'connected', updatedAt: new Date() })
                    .where(eq(crmIntegrations.id, integration.id))
                    .returning();
                
                 if (!updatedIntegration) throw new Error("Falha ao atualizar o registo de integração existente.");
                 integration = updatedIntegration;
                // Excluir contas antigas para esta integração para garantir que apenas uma credencial ativa exista
                await tx.delete(crmAccounts).where(eq(crmAccounts.integrationId, integration.id));

            } else {
                // Se não existe, crie a integração
                [integration] = await tx.insert(crmIntegrations).values({
                    companyId,
                    provider: 'kommo',
                    status: 'connected',
                }).returning();
            }

            if (!integration) {
                throw new Error("Falha ao criar ou encontrar o registo de integração.");
            }
            integrationId = integration.id;

            // Insira a nova conta/credencial
            await tx.insert(crmAccounts).values({
                integrationId: integration.id,
                domain,
                authType: authType,
                accessToken: encrypt(accessToken),
            });

            await tx.insert(crmSyncLogs).values({
                integrationId: integration.id,
                type: 'pull', // Connection is a pull action
                status: 'SUCCESS',
                payload: { message: `Conexão com domínio ${domain} estabelecida.` }
            });
        });

        return NextResponse.json({ success: true, message: 'Integração com a Kommo estabelecida com sucesso!' });

    } catch (error) {
        console.error('Erro ao conectar com a Kommo:', error);
        
        if (integrationId) {
             await db.insert(crmSyncLogs).values({
                integrationId: integrationId,
                type: 'pull',
                status: 'FAILED',
                error: (error as Error).message,
                payload: { message: `Tentativa de conexão falhou.` }
            });
        }
        
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
