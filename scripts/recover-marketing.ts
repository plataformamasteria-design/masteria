import { db } from '../src/lib/db';
import { marketingCredentials, connections } from '../src/lib/db/schema';
import { decrypt } from '../src/lib/crypto';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("--- Recuperando Tolerância de Falha de Login ---");
    const metaConns = await db.select().from(connections).where(eq(connections.connectionType, "meta_api"));

    let recoveredCount = 0;
    for (const conn of metaConns) {
        if (conn.wabaId === 'PENDING_OAUTH' && conn.accessToken && conn.companyId) {
            try {
                const token = decrypt(conn.accessToken);
                console.log(`Token decriptado para a empresa: ${conn.companyId}`);

                // Inserir na nova tabela Marketing Credentials recém-criada
                await db.insert(marketingCredentials).values({
                    companyId: conn.companyId,
                    platform: 'meta',
                    status: 'connected',
                    credentials: { access_token: token },
                    connectedAt: new Date()
                }).onConflictDoUpdate({
                    target: [marketingCredentials.companyId, marketingCredentials.platform],
                    set: {
                        status: 'connected',
                        credentials: { access_token: token },
                        updatedAt: new Date()
                    }
                });
                console.log("=> Inserido na Tabela de Marketing com sucesso.");

                // Vamos remover a conexao PENDING_OAUTH para limpar o cache do popup 
                // para que o Cliente possa ver a aba Limpa e se quiser finalizar o waba depois fica a critério
                await db.delete(connections).where(eq(connections.id, conn.id));
                console.log("=> Conexão PENDING órfã apagada.");
                recoveredCount++;

            } catch (e: any) {
                console.error("Erro na recuperação:", e.message);
            }
        }
    }

    console.log(`Finalizado. Cadastros recuperados: ${recoveredCount}`);
    process.exit(0);
}

main().catch(console.error);
