const fs = require('fs');

const schemaPath = 'src/lib/db/schema.ts';
let content = fs.readFileSync(schemaPath, 'utf8');

// Add 'index' to imports
if (!content.includes('  index,')) {
    content = content.replace(/pgEnum,/, "pgEnum,\n  index,");
}

// Regex to match:
// export const <exportName> = pgTable('<tableName>', { <columns> } <tail>
const tableRegex = /export const (\w+) = pgTable\('([^']+)',\s*({[\s\S]*?\n})\s*(?:,\s*\(([\w]+)\)\s*=>\s*\({([\s\S]*?)}\)\s*)?\);/g;

let match;
let newContent = content;

newContent = content.replace(tableRegex, (match, exportName, tableName, columns, paramName, existingIndexesStr) => {
    let newIndexes = [];
    
    const hasCompanyId = columns.includes("companyId:");
    const hasContactId = columns.includes("contactId:");
    const hasConnectionId = columns.includes("connectionId:");

    const checkStr = existingIndexesStr || "";
    
    const t = paramName || "table";

    if (hasCompanyId && !checkStr.includes("companyId") && !checkStr.includes("company_id")) {
        newIndexes.push(`${exportName}CompanyIdIdx: index('${tableName}_company_id_idx').on(${t}.companyId),`);
    }
    if (hasContactId && !checkStr.includes("contactId") && !checkStr.includes("contact_id")) {
        newIndexes.push(`${exportName}ContactIdIdx: index('${tableName}_contact_id_idx').on(${t}.contactId),`);
    }
    if (hasConnectionId && !checkStr.includes("connectionId") && !checkStr.includes("connection_id")) {
        newIndexes.push(`${exportName}ConnectionIdIdx: index('${tableName}_connection_id_idx').on(${t}.connectionId),`);
    }

    if (newIndexes.length === 0) return match;

    if (existingIndexesStr !== undefined) {
        // already has a callback
        const inserted = newIndexes.join("\n  ") + "\n  ";
        return `export const ${exportName} = pgTable('${tableName}', ${columns}, (${t}) => ({\n  ${inserted}${existingIndexesStr}}));`;
    } else {
        // no callback, ends with );
        const inserted = newIndexes.join("\n  ");
        return `export const ${exportName} = pgTable('${tableName}', ${columns}, (${t}) => ({\n  ${inserted}\n}));`;
    }
});

fs.writeFileSync(schemaPath, newContent, 'utf8');
console.log("Patched schema.ts successfully");
