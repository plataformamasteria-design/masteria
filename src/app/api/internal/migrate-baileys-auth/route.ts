import { NextResponse, type NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { db } from '@/lib/db';
import { connections, baileysAuthState } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');

        if (authHeader !== `Bearer baileys-migration-secret-2024`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let rootDirs: string[] = [];
        let zapmasterDirs: string[] = [];
        let whatsappSessionsDirs: string[] = [];

        try { rootDirs = await fs.readdir(process.cwd()); } catch (e) { }
        try { zapmasterDirs = await fs.readdir(path.join(process.cwd(), 'zapmaster')); } catch (e) { }
        try { whatsappSessionsDirs = await fs.readdir(path.join(process.cwd(), 'whatsapp_sessions')); } catch (e) { }

        const debugFileSystem = {
            cwd: process.cwd(),
            rootDirs,
            zapmasterDirs,
            whatsappSessionsDirs,
        };

        const authDir = path.join(process.cwd(), 'zapmaster', 'baileys_auth');
        let dirs: string[] = [];

        try {
            dirs = await fs.readdir(authDir);
        } catch (err: any) {
            return NextResponse.json({
                error: 'Diretório de auth não encontrado ou erro fs',
                path: authDir,
                debugFileSystem
            }, { status: 404 });
        }

        const stats = {
            totalFoldersFound: dirs.length,
            sessionFolders: 0,
            migrated: 0,
            failed: 0,
            skipped: 0,
            details: [] as string[]
        };

        for (const dir of dirs) {
            let connectionId = dir;
            if (dir.startsWith('session_')) {
                connectionId = dir.replace('session_', '');
            } else if (dir.startsWith('baileys_')) {
                continue;
            }

            stats.sessionFolders++;
            const sessionPath = path.join(authDir, dir);

            try {
                const [existingConn] = await db.select({
                    id: connections.id,
                    companyId: connections.companyId
                })
                    .from(connections)
                    .where(eq(connections.id, connectionId));

                if (!existingConn) {
                    stats.skipped++;
                    stats.details.push(`[SKIPPED] ${connectionId} - Connection não encontrada no BD`);
                    continue;
                }

                const files = await fs.readdir(sessionPath);

                let credsData = null;
                const keysData: Record<string, any> = {};
                let keysCount = 0;

                for (const file of files) {
                    if (!file.endsWith('.json')) continue;

                    const filePath = path.join(sessionPath, file);
                    const fileContent = await fs.readFile(filePath, 'utf-8');
                    const parsed = JSON.parse(fileContent);

                    if (file === 'creds.json') {
                        credsData = parsed;
                    } else {
                        const keyName = file.replace(/\.json$/, '');
                        keysData[keyName] = parsed;
                        keysCount++;
                    }
                }

                if (!credsData) {
                    stats.failed++;
                    stats.details.push(`[FAILED] ${connectionId} - Não possui creds.json`);
                    continue;
                }

                const [existingAuth] = await db.select({ id: baileysAuthState.id })
                    .from(baileysAuthState)
                    .where(eq(baileysAuthState.connectionId, connectionId));

                if (existingAuth) {
                    await db.update(baileysAuthState)
                        .set({
                            creds: credsData,
                            keys: keysData,
                            updatedAt: new Date(),
                        })
                        .where(eq(baileysAuthState.connectionId, connectionId));
                    stats.migrated++;
                    stats.details.push(`[OVERWRITTEN] ${connectionId} - creds + ${keysCount} keys`);
                } else {
                    await db.insert(baileysAuthState).values({
                        companyId: existingConn.companyId,
                        connectionId: existingConn.id,
                        creds: credsData,
                        keys: keysData,
                        updatedAt: new Date(),
                    });
                    stats.migrated++;
                    stats.details.push(`[INSERTED] ${connectionId} - creds + ${keysCount} keys`);
                }

            } catch (error: any) {
                stats.failed++;
                stats.details.push(`[ERROR] ${connectionId} - Falha ao processar: ${error.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Processamento de migração finalizado',
            debugFileSystem,
            foundDirs: dirs,
            stats
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: 'Erro crítico na migração', details: error.message },
            { status: 500 }
        );
    }
}
