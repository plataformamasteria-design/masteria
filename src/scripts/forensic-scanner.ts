// src/scripts/forensic-scanner.ts
import * as fs from 'fs';
import * as path from 'path';
import * as schema from '@/lib/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';

interface Inventory {
    tables: string[];
    apiRoutes: string[];
    serverActionsFiles: string[];
}

interface ScanResult {
    file: string;
    type: 'route' | 'action' | 'component';
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
    issues: string[];
}

const ROOT_DIR = process.cwd();

// 1. Identify Tenant Tables
const tenantTables = new Set<string>();
const globalTables = new Set<string>();

function mapTableScopes() {
    for (const [key, value] of Object.entries(schema)) {
        if (!value || typeof value !== 'object') continue;
        try {
            const config = getTableConfig(value as any);
            const columns = getTableColumns(value as any);
            if (!config?.name) continue;

            const hasCompanyId = Object.values(columns).some((c: any) => c.name === 'company_id');
            if (hasCompanyId) {
                tenantTables.add(config.name);
                // Also add the variable name used in imports (usually matches naming convention)
                tenantTables.add(key);
            } else {
                globalTables.add(config.name);
            }
        } catch (e) {
            // Empty block
            console.log('Empty block');
        }
    }
}

// 2. Scanner Logic
function scanFile(filePath: string, type: 'route' | 'action'): ScanResult {
    const content = fs.readFileSync(path.join(ROOT_DIR, filePath), 'utf8');
    const issues: string[] = [];
    let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE' = 'SAFE';

    // Rule 1: Auth Check
    const hasAuth = content.includes('getCompanyIdFromSession') || content.includes('auth()') || content.includes('getUserIdFromSession');
    if (!hasAuth && type === 'route' && !filePath.includes('/auth/')) {
        // Some webhooks might verify signature instead of session
        if (filePath.includes('/webhooks/') || filePath.includes('/cron/')) {
            issues.push('⚠️ No Session Auth (Webhook/Cron - verify verifySignature implementation)');
            if (riskLevel === 'SAFE') riskLevel = 'LOW';
        } else {
            issues.push('🚨 MISSING AUTH: No getCompanyIdFromSession found in API Route');
            riskLevel = 'HIGH';
        }
    }

    // Rule 2: DB Access without Filter
    tenantTables.forEach(table => {
        // Regex to find "from(table)" or "db.select()...table"
        // This is naive but effective for a first pass
        const usageRegex = new RegExp(`from\\(\\s*${table}\\s*\\)`, 'g');
        if (usageRegex.test(content)) {
            // Found table usage. Now look for "companyId" in the same block/chain
            // We'll search in a window of 500 chars after the usage
            const index = content.indexOf(`from(${table})`);
            const window = content.substring(index, index + 500);

            if (!window.includes('companyId')) {
                // Check if it's a "find by id AND companyId" logic 
                // or if it's potentially missing
                issues.push(`🚨 POTENTIAL LEAK: Accessing '${table}' without explicit 'companyId' filter nearby.`);
                if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
            }
        }
    });

    return { file: filePath, type, riskLevel, issues };
}

async function main() {
    console.log('🕵️  INICIANDO SCAN FORENSE DE CÓDIGO (SAST) 🕵️');

    // Load Inventory
    if (!fs.existsSync('FORENSIC_INVENTORY.json')) {
        console.error('❌ Run Inventory first!');
        process.exit(1);
    }
    const inventory: Inventory = JSON.parse(fs.readFileSync('FORENSIC_INVENTORY.json', 'utf8'));

    mapTableScopes();
    console.log(`ℹ️  Scope: ${tenantTables.size} Tenant Tables, ${globalTables.size} Global Tables`);

    const results: ScanResult[] = [];

    // Scan Routes
    console.log(`🔍 Scanning ${inventory.apiRoutes.length} API Routes...`);
    for (const route of inventory.apiRoutes) {
        results.push(scanFile(route, 'route'));
    }

    // Scan Actions
    console.log(`🔍 Scanning ${inventory.serverActionsFiles.length} Server Action Files...`);
    for (const action of inventory.serverActionsFiles) {
        results.push(scanFile(action, 'action'));
    }

    // Filter High Risk
    const highRisk = results.filter(r => r.riskLevel === 'HIGH');
    const mediumRisk = results.filter(r => r.riskLevel === 'MEDIUM');

    console.log(`\n📊 RESULTADOS DO SCAN:`);
    console.log(`   - 🔴 ALTO RISCO: ${highRisk.length}`);
    console.log(`   - 🟠 MÉDIO RISCO: ${mediumRisk.length}`);
    console.log(`   - 🟢 SEGURO: ${results.length - highRisk.length - mediumRisk.length}`);

    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            high: highRisk.length,
            medium: mediumRisk.length,
            total: results.length
        },
        highRiskDetails: highRisk,
        mediumRiskDetails: mediumRisk
    };

    fs.writeFileSync('FORENSIC_SCAN_RESULTS.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Resultados salvos em FORENSIC_SCAN_RESULTS.json');
}

main().catch(console.error);
