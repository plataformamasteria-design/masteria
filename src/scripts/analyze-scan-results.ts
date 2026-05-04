// src/scripts/analyze-scan-results.ts
import * as fs from 'fs';

interface ScanResult {
    file: string;
    type: 'route' | 'action' | 'component';
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
    issues: string[];
}

interface Report {
    highRiskDetails: ScanResult[];
}

const report: Report = JSON.parse(fs.readFileSync('FORENSIC_SCAN_RESULTS.json', 'utf8'));

console.log(`\n🔴 TOTAL HIGH RISK FINDINGS: ${report.highRiskDetails.length}\n`);

const missingAuth: string[] = [];
const potentialLeak: string[] = [];

report.highRiskDetails.forEach(item => {
    item.issues.forEach(issue => {
        if (issue.includes('MISSING AUTH')) {
            missingAuth.push(item.file);
        } else if (issue.includes('POTENTIAL LEAK')) {
            potentialLeak.push(`${item.file} -> ${issue}`);
        }
    });
});

console.log('--- MISSING AUTH ROUTES (Explicit check needed) ---');
missingAuth.forEach(f => console.log(`  ${f}`));

console.log('\n--- POTENTIAL DB LEAKS (Missing companyId filter) ---');
potentialLeak.forEach(f => console.log(`  ${f}`));
