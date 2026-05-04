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
        } else if (file.endsWith('.tsx') && file.includes('-node')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let hasChanges = false;
            
            // We want to make sure the div directly wrapping the Handle has relative
            // Usually it looks like:
            // <div className="flex flex-col items-center gap-1">
            //     <span ...>
            //     <Handle ... />
            
            const regexes = [
                /className="flex flex-col items-center gap-[0-9.]+"/g,
                /className="flex flex-col items-center gap-[0-9.]+"(?=\s*>)/g,
                /className="flex flex-col items-center"/g,
                /className="flex flex-col items-center gap-1.5"/g
            ];

            let newContent = content;
            for (const r of regexes) {
                 newContent = newContent.replace(r, (match) => {
                     if (!match.includes('relative')) {
                         return match.replace(/"$/, ' relative"');
                     }
                     return match;
                 });
            }

            if (newContent !== content) {
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
