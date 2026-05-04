const fs = require('fs');
const path = require('path');

const nodesDir = 'c:\\Users\\Administrator\\Desktop\\MASTER-IA-PROJECT\\src\\components\\automations\\nodes';

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    let changedFiles = 0;

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            changedFiles += processDirectory(fullPath);
        } else if (file.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            const targetString = "style={{ position: 'relative', transform: 'none', left: 'auto', bottom: 'auto' }}";
            
            if (content.includes(targetString)) {
                // If we just remove it, we need to make sure the handles don't stack up in the center.
                // Wait! If they are inside flex items, removing the absolute override makes them position:absolute relative to the node!
                // But if they are inside a flex wrapper that has `relative`, they position relative to the wrapper.
                // Let's just remove the style attribute entirely.
                const newContent = content.split(targetString).join("");
                fs.writeFileSync(fullPath, newContent, 'utf8');
                console.log(`Updated: ${file}`);
                changedFiles++;
            }
        }
    }
    return changedFiles;
}

const total = processDirectory(nodesDir);
console.log(`Total files updated: ${total}`);
