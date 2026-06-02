const fs = require('fs');

const schemaPath = 'src/lib/db/schema.ts';
let content = fs.readFileSync(schemaPath, 'utf8');

if (!content.includes('  index,')) {
    content = content.replace(/pgEnum,/, "pgEnum,\n  index,");
}

const lines = content.split('\n');
let newLines = [];
let i = 0;

while (i < lines.length) {
    let line = lines[i];
    if (line.startsWith('export const ') && line.includes(' = pgTable(')) {
        const exportNameMatch = line.match(/export const (\w+) =/);
        // support single or double quotes
        const tableNameMatch = line.match(/pgTable\(['"]([^'"]+)['"]/);
        if (!exportNameMatch || !tableNameMatch) {
            newLines.push(line);
            i++;
            continue;
        }
        
        const exportName = exportNameMatch[1];
        const tableName = tableNameMatch[1];
        
        let tableBuffer = [line];
        i++;
        
        let braceCount = 1;
        let hasCompanyId = false;
        let hasContactId = false;
        let hasConnectionId = false;
        
        while (i < lines.length) {
            let innerLine = lines[i];
            tableBuffer.push(innerLine);
            
            if (innerLine.includes('companyId:')) hasCompanyId = true;
            if (innerLine.includes('contactId:')) hasContactId = true;
            if (innerLine.includes('connectionId:')) hasConnectionId = true;
            
            braceCount += (innerLine.match(/\{/g) || []).length;
            braceCount -= (innerLine.match(/\}/g) || []).length;
            
            if (braceCount === 0) {
                break;
            }
            i++;
        }
        
        const fullTableStr = tableBuffer.join('\n');
        
        let newIndexes = [];
        let tParam = 'table';
        
        const callbackMatch = fullTableStr.match(/},\s*\(([\w]+)\)\s*=>\s*\(\{([\s\S]*?)\}\)\);/);
        
        if (hasCompanyId && !fullTableStr.includes('company_id_idx') && !fullTableStr.includes('company_id_full_idx')) {
             newIndexes.push(`${exportName}CompanyIdIdx: index('${tableName}_company_id_idx').on(table.companyId),`);
        }
        if (hasContactId && !fullTableStr.includes('contact_id_idx') && !fullTableStr.includes('contact_id_full_idx')) {
             newIndexes.push(`${exportName}ContactIdIdx: index('${tableName}_contact_id_idx').on(table.contactId),`);
        }
        if (hasConnectionId && !fullTableStr.includes('connection_id_idx') && !fullTableStr.includes('connection_id_full_idx')) {
             newIndexes.push(`${exportName}ConnectionIdIdx: index('${tableName}_connection_id_idx').on(table.connectionId),`);
        }
        
        if (newIndexes.length > 0) {
            if (callbackMatch) {
                const param = callbackMatch[1];
                const innerBody = callbackMatch[2];
                const replacedIndexes = newIndexes.map(idx => idx.replace(/table\./g, param + '.')).join('\n  ');
                
                const newCallback = `}, (${param}) => ({\n  ${replacedIndexes}${innerBody}}));`;
                const newFullTable = fullTableStr.replace(callbackMatch[0], newCallback);
                newLines.push(newFullTable);
            } else {
                const replacedIndexes = newIndexes.join('\n  ');
                const newFullTable = fullTableStr.replace(/\}\);$/, `}, (table) => ({\n  ${replacedIndexes}\n}));`);
                newLines.push(newFullTable);
            }
        } else {
            newLines.push(fullTableStr);
        }
    } else {
        newLines.push(line);
    }
    i++;
}

fs.writeFileSync(schemaPath, newLines.join('\n'), 'utf8');
console.log("Patched schema.ts successfully");
