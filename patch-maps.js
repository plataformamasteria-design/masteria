const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src', 'components', 'automations', 'nodes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

let totalReplacements = 0;

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    let newContent = content.replace(/([a-zA-Z0-9_\.]+)\.map\(/g, (match, varName) => {
        if (varName.includes('Array.isArray')) return match;
        if (varName === 'React.Children' || varName === 'CHILDREN') return match;

        // Convert foo.map( to ((Array.isArray(foo) ? foo : []) || []).map(
        return `((Array.isArray(${varName}) ? ${varName} : []) || []).map(`;
    });

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        totalReplacements++;
        console.log(`Patched ${file}`);
    }
});

console.log('Total files patched:', totalReplacements);
