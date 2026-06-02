const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes("from 'framer-motion'") || content.includes('from "framer-motion"')) {
        if (!content.includes('m as motion')) {
            let replaced = content.replace(/import\s*{([^}]+)}\s*from\s*['"]framer-motion['"]/g, (match, imports) => {
                let newImports = imports.split(',').map(i => i.trim()).filter(Boolean).map(i => {
                    if (i === 'motion') return 'm as motion';
                    return i;
                }).join(', ');
                return `import { ${newImports} } from 'framer-motion'`;
            });
            if (replaced !== content) {
                fs.writeFileSync(file, replaced, 'utf8');
                console.log('Patched', file);
            }
        }
    }
});
