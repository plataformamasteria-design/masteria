
import { db } from '@/lib/db';
import { personaExternalSources, storageFiles } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function main() {
    process.stdout.write("START_JSON\n");
    try {
        const sources = await db.select()
            .from(personaExternalSources)
            .orderBy(desc(personaExternalSources.createdAt))
            .limit(5);

        const results = [];
        for (const source of sources) {
            let fileExists = null;
            let dbFile = null;

            if (source.s3Key && source.companyId) {
                const rawKey = source.s3Key;
                const companyId = source.companyId;
                const absolutePrefix = `tenants/${companyId}/`;
                const scopedKey = rawKey.startsWith(absolutePrefix) ? rawKey : `${absolutePrefix}${rawKey}`;

                const file = await db.query.storageFiles.findFirst({
                    where: eq(storageFiles.key, scopedKey),
                    columns: { id: true, size: true }
                });

                if (file) {
                    fileExists = true;
                    dbFile = file;
                } else {
                    const fileRaw = await db.query.storageFiles.findFirst({
                        where: eq(storageFiles.key, rawKey),
                        columns: { id: true, size: true }
                    });
                    if (fileRaw) {
                        fileExists = 'raw_only';
                        dbFile = fileRaw;
                    } else {
                        fileExists = false;
                    }
                }
            }

            results.push({
                id: source.id,
                name: source.name,
                type: source.sourceType,
                status: source.syncStatus,
                error: source.syncError,
                s3Key: source.s3Key,
                companyId: source.companyId,
                fileHealth: { exists: fileExists, size: dbFile?.size, scopedKey: source.s3Key ? `tenants/${source.companyId}/${source.s3Key.replace('tenants/', '')}` : null }
            });
        }
        console.log(JSON.stringify(results, null, 2));
    } catch (e: any) {
        console.error(JSON.stringify({ error: e.message }));
    }
    process.stdout.write("\nEND_JSON\n");
    process.exit(0);
}

main().catch(console.error);
