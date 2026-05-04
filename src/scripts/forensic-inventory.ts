// src/scripts/forensic-inventory.ts
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '@/lib/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');

interface Inventory {
    timestamp: string;
    stats: {
        tables: number;
        apiRoutes: number;
        serverActions: number;
        pages: number;
        components: number;
    };
    tables: string[];
    apiRoutes: string[];
    serverActionsFiles: string[];
    pages: string[];
    components: string[];
}

const inventory: Inventory = {
    timestamp: new Date().toISOString(),
    stats: { tables: 0, apiRoutes: 0, serverActions: 0, pages: 0, components: 0 },
    tables: [],
    apiRoutes: [],
    serverActionsFiles: [],
    pages: [],
    components: []
};

// 1. Map Tables
function mapTables() {
    console.log('📦 Mapping Database Tables...');
    for (const [key, value] of Object.entries(schema)) {
        if (!value || typeof value !== 'object') continue;
        try {
            const config = getTableConfig(value as any);
            if (config && config.name) {
                inventory.tables.push(config.name);
            }
        } catch (e) {
            // Not a table
        }
    }
    inventory.stats.tables = inventory.tables.length;
}

// 2. Walk Directory Generic
function walkDir(dir: string, callback: (entry: string) => void) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath, callback);
        } else {
            callback(fullPath);
        }
    }
}

// 3. Map File System items
function mapFileSystem() {
    console.log('📂 Mapping File System...');

    walkDir(SRC_DIR, (filePath) => {
        const relative = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');

        // API Routes
        if (relative.includes('src/app/api') && relative.endsWith('route.ts')) {
            inventory.apiRoutes.push(relative);
        }

        // Server Actions
        if (relative.includes('actions.ts') || relative.includes('/actions/')) {
            if (relative.endsWith('.ts') && !relative.endsWith('.d.ts')) {
                inventory.serverActionsFiles.push(relative);
            }
        }

        // Pages
        if (relative.endsWith('page.tsx')) {
            inventory.pages.push(relative);
        }

        // Components
        if (relative.includes('src/components') && (relative.endsWith('.tsx') || relative.endsWith('.ts'))) {
            inventory.components.push(relative);
        }
    });

    inventory.stats.apiRoutes = inventory.apiRoutes.length;
    inventory.stats.serverActions = inventory.serverActionsFiles.length;
    inventory.stats.pages = inventory.pages.length;
    inventory.stats.components = inventory.components.length;
}

async function main() {
    console.log('🕵️  INICIANDO INVENTÁRIO FORENSE 🕵️');

    mapTables();
    mapFileSystem();

    console.log('\n📊 ESTATÍSTICAS DO SISTEMA:');
    console.log(`   - Tabelas de Dados: ${inventory.stats.tables}`);
    console.log(`   - Rotas de API: ${inventory.stats.apiRoutes}`);
    console.log(`   - Arquivos de Actions: ${inventory.stats.serverActions}`);
    console.log(`   - Páginas (Pages): ${inventory.stats.pages}`);
    console.log(`   - Componentes UI: ${inventory.stats.components}`);

    fs.writeFileSync('FORENSIC_INVENTORY.json', JSON.stringify(inventory, null, 2));
    console.log('\n✅ Inventário salvo em FORENSIC_INVENTORY.json');
}

main().catch(console.error);
