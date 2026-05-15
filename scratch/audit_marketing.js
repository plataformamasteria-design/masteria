const fs = require('fs');
const path = require('path');

function scanDir(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            scanDir(filePath, fileList);
        } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const targets = [
    'src/app/(main)/marketing',
    'src/components/trafego',
    'src/components/marketing',
];

let allFiles = [];
targets.forEach(t => {
    allFiles = allFiles.concat(scanDir(path.join(__dirname, '..', t)));
});

const results = [];

allFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const fileResult = { file: file.replace(path.join(__dirname, '..') + '\\', ''), issues: [] };
    
    let mockDataCount = 0;
    let todoCount = 0;
    let anyCount = 0;
    let fetchMissingCount = 0;

    lines.forEach((line, i) => {
        const lineNumber = i + 1;
        if (line.toLowerCase().includes('// todo') || line.toLowerCase().includes('// fixme')) {
            fileResult.issues.push({ line: lineNumber, type: 'TODO', text: line.trim() });
            todoCount++;
        }
        if (line.includes('mock') || line.includes('dummy') || line.includes('static data')) {
            // Ignore imports of mock or variables with mock if they are standard, but log them
            fileResult.issues.push({ line: lineNumber, type: 'MOCK', text: line.trim() });
            mockDataCount++;
        }
        if (line.includes(': any') && !line.includes('eslint-disable')) {
            anyCount++;
        }
        if (line.includes('fetch(')) {
            // Extract URL
            const match = line.match(/fetch\(['"`](.*?)['"`]/);
            if (match && match[1].includes('/api/')) {
                // We could cross-reference with api routes, but just log it
                fileResult.issues.push({ line: lineNumber, type: 'FETCH', text: match[1] });
            }
        }
    });

    if (fileResult.issues.length > 0 || anyCount > 0) {
        fileResult.anyCount = anyCount;
        results.push(fileResult);
    }
});

// Output summary
console.log(`Audited ${allFiles.length} files.`);
results.forEach(r => {
    console.log(`\n--- ${r.file} ---`);
    console.log(`'any' types found: ${r.anyCount}`);
    r.issues.forEach(i => {
        console.log(`[${i.type}] L${i.line}: ${i.text}`);
    });
});
