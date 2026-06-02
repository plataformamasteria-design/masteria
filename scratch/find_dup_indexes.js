const fs = require('fs');

const content = fs.readFileSync('src/lib/db/schema.ts', 'utf8');
const indexRegex = /index\('([^']+)'\)/g;
let match;
let indexes = new Set();
let dups = new Set();

while ((match = indexRegex.exec(content)) !== null) {
  const name = match[1];
  if (indexes.has(name)) {
    dups.add(name);
  } else {
    indexes.add(name);
  }
}

console.log("Duplicated indexes:", Array.from(dups));
