/**
 * Baileys Auth Storage - Backup/Restore para Replit Object Storage
 * 
 * Persiste credenciais de autenticação do Baileys no Object Storage
 * para sobreviver a deploys/restarts do Replit.
 */

import { ObjectStorageService } from '@/lib/server/objectStorage';
import * as fs from 'fs';
import * as path from 'path';

const objectStorage = new ObjectStorageService();
const AUTH_STORAGE_PREFIX = 'baileys_auth';

/**
 * Faz backup de todos os arquivos de auth de uma sessão para o Object Storage
 */
export async function backupAuthToObjectStorage(connectionId: string, authPath: string): Promise<boolean> {
    try {
        // Skip se não estamos no Replit ou Railway
        if (process.platform === 'win32' || (!process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID && !process.env.RAILWAY_ENVIRONMENT)) {
            console.log(`[BaileysAuth] Skipping backup (not cloud environment): ${connectionId}`);
            return false;
        }

        // Verificar se o diretório de auth existe
        if (!fs.existsSync(authPath)) {
            console.log(`[BaileysAuth] Auth path does not exist: ${authPath}`);
            return false;
        }

        const files = fs.readdirSync(authPath);
        if (files.length === 0) {
            console.log(`[BaileysAuth] No auth files to backup for ${connectionId}`);
            return false;
        }

        console.log(`[BaileysAuth] Backing up ${files.length} auth files for ${connectionId}...`);

        for (const file of files) {
            const filePath = path.join(authPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isFile()) {
                const content = fs.readFileSync(filePath);
                const key = `${AUTH_STORAGE_PREFIX}/${connectionId}/${file}`;

                await objectStorage.uploadFile(key, content, 'application/json');
                console.log(`[BaileysAuth] ✅ Backed up: ${file}`);
            }
        }

        console.log(`[BaileysAuth] ✅ Backup complete for ${connectionId}`);
        return true;
    } catch (error) {
        console.error(`[BaileysAuth] ❌ Backup failed for ${connectionId}:`, error);
        return false;
    }
}

/**
 * Restaura arquivos de auth do Object Storage para o filesystem
 */
export async function restoreAuthFromObjectStorage(connectionId: string, authPath: string): Promise<boolean> {
    try {
        // Skip se não estamos no Replit ou Railway
        if (process.platform === 'win32' || (!process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID && !process.env.RAILWAY_ENVIRONMENT)) {
            console.log(`[BaileysAuth] Skipping restore (not cloud environment): ${connectionId}`);
            return false;
        }

        // Lista de arquivos comuns do Baileys auth
        const authFiles = ['creds.json', 'app-state-sync-key-*.json', 'pre-key-*.json', 'sender-key-*.json', 'session-*.json'];
        const credsKey = `${AUTH_STORAGE_PREFIX}/${connectionId}/creds.json`;

        // Verificar se existe creds.json no Object Storage
        const hasBackup = await objectStorage.fileExists(credsKey);

        if (!hasBackup) {
            console.log(`[BaileysAuth] No backup found in Object Storage for ${connectionId}`);
            return false;
        }

        console.log(`[BaileysAuth] Restoring auth from Object Storage for ${connectionId}...`);

        // Criar diretório de auth se não existir
        if (!fs.existsSync(authPath)) {
            fs.mkdirSync(authPath, { recursive: true, mode: 0o777 });
        }

        // Restaurar creds.json (arquivo principal)
        try {
            const stream = await objectStorage.getFileStream(credsKey);
            const chunks: Buffer[] = [];

            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }

            const buffer = Buffer.concat(chunks);
            fs.writeFileSync(path.join(authPath, 'creds.json'), buffer);
            console.log(`[BaileysAuth] ✅ Restored: creds.json`);
        } catch (error: any) {
            console.error(`[BaileysAuth] ❌ Failed to restore creds.json:`, error?.message);
            return false;
        }

        // Tentar restaurar outros arquivos conhecidos (best effort)
        const otherFiles = [
            'app-state-sync-key-AAAAAA.json',
            'app-state-sync-key-AAAAAN.json',
            'pre-key-1.json',
            'pre-key-2.json',
            'session-0.json',
        ];

        for (const file of otherFiles) {
            try {
                const key = `${AUTH_STORAGE_PREFIX}/${connectionId}/${file}`;
                const exists = await objectStorage.fileExists(key);

                if (exists) {
                    const stream = await objectStorage.getFileStream(key);
                    const chunks: Buffer[] = [];

                    for await (const chunk of stream) {
                        chunks.push(Buffer.from(chunk));
                    }

                    const buffer = Buffer.concat(chunks);
                    fs.writeFileSync(path.join(authPath, file), buffer);
                    console.log(`[BaileysAuth] ✅ Restored: ${file}`);
                }
            } catch {
                // Ignorar - arquivo pode não existir
            }
        }

        console.log(`[BaileysAuth] ✅ Restore complete for ${connectionId}`);
        return true;
    } catch (error) {
        console.error(`[BaileysAuth] ❌ Restore failed for ${connectionId}:`, error);
        return false;
    }
}

/**
 * Sincroniza um arquivo específico de credenciais para o Object Storage
 * Chamado em sock.ev.on('creds.update', saveCreds)
 */
export async function syncCredsToObjectStorage(connectionId: string, authPath: string): Promise<void> {
    try {
        // Skip se não estamos no Replit ou Railway
        if (process.platform === 'win32' || (!process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID && !process.env.RAILWAY_ENVIRONMENT)) {
            return;
        }

        const credsPath = path.join(authPath, 'creds.json');

        if (!fs.existsSync(credsPath)) {
            return;
        }

        const content = fs.readFileSync(credsPath);
        const key = `${AUTH_STORAGE_PREFIX}/${connectionId}/creds.json`;

        await objectStorage.uploadFile(key, content, 'application/json');
        console.log(`[BaileysAuth] 🔄 Synced creds.json for ${connectionId}`);
    } catch (error) {
        console.error(`[BaileysAuth] ❌ Sync failed for ${connectionId}:`, error);
    }
}

/**
 * Remove backup do Object Storage quando sessão é deletada
 */
export async function deleteAuthFromObjectStorage(connectionId: string): Promise<void> {
    try {
        // Skip se não estamos no Replit ou Railway
        if (process.platform === 'win32' || (!process.env.REPL_ID && !process.env.REPLIT_DEPLOYMENT_ID && !process.env.RAILWAY_ENVIRONMENT)) {
            return;
        }

        const files = ['creds.json', 'app-state-sync-key-AAAAAA.json', 'app-state-sync-key-AAAAAN.json'];

        for (const file of files) {
            try {
                const key = `${AUTH_STORAGE_PREFIX}/${connectionId}/${file}`;
                await objectStorage.deleteFile(key);
            } catch {
                // Ignorar erros de arquivos que não existem
            }
        }

        console.log(`[BaileysAuth] 🗑️ Deleted backup for ${connectionId}`);
    } catch (error) {
        console.error(`[BaileysAuth] ❌ Delete backup failed for ${connectionId}:`, error);
    }
}
