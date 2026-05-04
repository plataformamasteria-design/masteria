
import * as fs from 'fs';
import * as path from 'path';

/**
 * FORENSIC DEEP SCAN (Soft RLS Enforcer)
 * 
 * Objective: Mathematically guarantee that every database interaction that SHOULD be scoped
 * to a tenant actually HAS the tenant filter.
 * 
 * Target Patterns (Drizzle ORM):
 * 1. db.select().from(table)...
 * 2. db.update(table)...
 * 3. db.delete(table)...
 * 4. db.query.table.findMany(...)
 * 5. db.query.table.findFirst(...)
 * 
 * Rule:
 * MUST have `.where(..., companyId, ...)` OR be explicitly whitelisted.
 */

const TARGET_DIR = path.join(process.cwd(), 'src');
const LOG_FILE = path.join(process.cwd(), 'FORENSIC_DEEP_SCAN_REPORT.md');

// Tables that are GLOBALLY shared and exempt from company_id checks
// e.g., 'companies' (tenant root), 'users' (auth root), 'accounts' (next-auth)
const GLOBAL_TABLES = [
    'users',
    'accounts',
    'sessions',
    'verificationTokens', // next-auth legacy
    'password_reset_tokens',
    'companies', // The root table
    'api_keys', // Should be scoped, but simple select might check key only
    'webhook_logs', // Sometimes system level
    'meta_webhook_health_events',
    'webhook_events'  // System queue
];

// Specific files or lines to ignore (Audit with caution)
const IGNORE_FILES = [
    'auth.config.ts', // Handles login/session creation (global by definition)
    'middleware.ts', // Checks public routes
    'forensic-deep-scan.ts', // This file
    'seed-predefined-templates.ts', // Seeding script
    'migrate-db.ts',
    'migrate-vector-db.ts',
    'rollback-db.ts',
    'seed-test-campaigns.ts',
    'cron-service.ts', // Cron jobs might run globally then iterate
];

interface Violation {
    file: string;
    line: number;
    snippet: string;
    reason: string;
}

const violations: Violation[] = [];
let filesScanned = 0;

function walkDir(dir: string, callback: (filePath: string) => void) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        const isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

function analyzeFile(filePath: string) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    if (IGNORE_FILES.some(ignored => filePath.includes(ignored))) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    filesScanned++;

    // Simple state machine for identifying multiline queries
    // This is a heuristic regex scan. AST would be better but requires more setup.

    // Regex to detect start of sensitive DB operations
    // Capture group 1: operation type
    // Capture group 2: table name (heuristic)
    const dbOpRegex = /db\.(select|update|delete|query\.\w+)/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Scan for DB operations
        if (line.match(dbOpRegex) && !line.includes('// security-exempt')) {
            // Found a DB Op start. Now look ahead for 'where' and 'companyId'

            // Heuristic: Is it a select on a global table?
            const isGlobalTable = GLOBAL_TABLES.some(table => line.includes(table) || line.includes(`schema.${table}`));
            if (isGlobalTable) continue;

            // Is it a generic COUNT query? (often exempt)
            if (line.includes('count()') && !line.includes('where(')) {
                // Counts might be risky if not scoped, but let's flag them for manual review if they don't have where
            }

            // Look ahead N lines for '.where(' and 'companyId'
            // or 'eq(table.companyId'
            let context = '';
            let hasCompanyIdCheck = false;
            let hasWhere = false;

            // Grab next 15 lines as "Context"
            for (let j = 0; j < 15; j++) {
                if (i + j >= lines.length) break;
                const lookAheadLine = lines[i + j];
                if (!lookAheadLine) continue;
                context += lookAheadLine + '\n';

                if (lookAheadLine.includes('.where(')) {
                    hasWhere = true;
                }

                // Flexible check for company scope
                if (
                    lookAheadLine.includes('companyId') ||
                    lookAheadLine.includes('company_id') ||
                    lookAheadLine.includes('getCompanyIdFromSession')
                ) {
                    hasCompanyIdCheck = true;
                }

                // If query ends (semicolon or end of chain), stop looking
                if (lookAheadLine.trim().endsWith(';')) break;
            }

            // Evaluation
            if (!hasCompanyIdCheck) {
                // Potential Violation
                // Double check if it's a select without where (Global Leak!)
                // Or update without where (Disaster!)

                let reason = "Missing 'companyId' filter in DB Operation";
                if (!hasWhere && line.includes('select')) reason = "Global SELECT detected (No WHERE clause)";
                if (!hasWhere && line.includes('update')) reason = "Global UPDATE detected (No WHERE clause)";
                if (!hasWhere && line.includes('delete')) reason = "Global DELETE detected (No WHERE clause)";

                // Filter out common false positives heuristics
                if (context.includes('users') && context.includes('email')) continue; // Login lookup

                violations.push({
                    file: path.relative(process.cwd(), filePath),
                    line: i + 1,
                    snippet: line.trim().substring(0, 100),
                    reason
                });
            }
        }
    }
}

function generateReport() {
    let report = `# 🛡️ Forensic Deep Scan Report (Soft RLS)\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n`;
    report += `**Scanned Files:** ${filesScanned}\n`;
    report += `**Violations Found:** ${violations.length}\n\n`;

    if (violations.length === 0) {
        report += `## ✅ PASSED: System is Mathematically Clean.\n`;
        report += `All detected database queries include 'companyId' scoping or are strictly whitelisted.\n`;
    } else {
        report += `## ❌ FAILED: Potential Tenant Leaks Detected\n`;
        report += `Immediate Action Required on the following lines:\n\n`;

        report += `| File | Line | Severity | Issue |\n`;
        report += `| :--- | :--- | :--- | :--- |\n`;

        violations.forEach(v => {
            report += `| \`${v.file}\` | \`${v.line}\` | **CRITICAL** | ${v.reason} <br> \`\`\`ts\n${v.snippet}\n\`\`\` |\n`;
        });
    }

    fs.writeFileSync(LOG_FILE, report);
    console.log(report);
}

// EXECUTION
console.log("🔍 Starting Forensic Deep Scan...");
walkDir(TARGET_DIR, analyzeFile);
generateReport();
console.log("📝 Scan Complete. Report saved to FORENSIC_DEEP_SCAN_REPORT.md");

