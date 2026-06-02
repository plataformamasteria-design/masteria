const fs = require('fs');

const schemaPath = 'src/lib/db/schema.ts';
const content = fs.readFileSync(schemaPath, 'utf8');

const tableRegex = /export const (\w+) = pgTable\('([^']+)',\s*{([\s\S]*?)}(?:,\s*\((table)\) => ({([\s\S]*?)}))?\)/g;

let match;
const results = [];
while ((match = tableRegex.exec(content)) !== null) {
  const exportName = match[1];
  const tableName = match[2];
  const columnsStr = match[3];
  const indexStr = match[6] || '';

  if (columnsStr.includes('companyId')) {
    if (!indexStr.includes('companyId')) {
      results.push(`Table ${tableName} (${exportName}) HAS companyId but NO index on it.`);
    }
  }
  
  // also check other foreign keys like connectionId, contactId
  if (columnsStr.includes('connectionId') && !indexStr.includes('connectionId')) {
     results.push(`Table ${tableName} (${exportName}) HAS connectionId but NO index on it.`);
  }
  if (columnsStr.includes('contactId') && !indexStr.includes('contactId')) {
     results.push(`Table ${tableName} (${exportName}) HAS contactId but NO index on it.`);
  }
}

console.log(`Found ${results.length} issues.`);
console.log(results.join('\n'));
