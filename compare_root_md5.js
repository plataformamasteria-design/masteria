const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const railwaySums = fs.readFileSync('railway_root_md5.txt', 'utf16le')
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
        const [md5, ...fileParts] = line.trim().split(/\s+/);
        if (md5 && fileParts.length) {
            let name = fileParts.join(' ').replace('\r', '');
            if (name.startsWith('./')) name = name.substring(2);
            acc[name] = md5;
        }
        return acc;
    }, {});

const localFiles = fs.readdirSync('.').filter(f => fs.statSync(f).isFile() && !f.endsWith('.txt') && !f.endsWith('.js'));
const localSums = {};

for (const file of localFiles) {
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    localSums[file] = hash;
}

const diff = { missingLocal: [], missingRemote: [], changed: [] };

for (const [file, remoteSum] of Object.entries(railwaySums)) {
    if (!localSums[file] && !file.endsWith('.txt') && !file.endsWith('.js')) {
        diff.missingLocal.push(file);
    } else if (localSums[file] && localSums[file] !== remoteSum) {
        diff.changed.push(file);
    }
}

for (const file of Object.keys(localSums)) {
    if (!railwaySums[file]) {
        diff.missingRemote.push(file);
    }
}

console.log('=== RELATÓRIO DE COMPARAÇÃO (RAIZ) ===');
if (diff.changed.length) {
    diff.changed.forEach(f => console.log(`[MODIFICADO] ${f}`));
}
if (diff.missingLocal.length) {
    diff.missingLocal.forEach(f => console.log(`[FALTANDO LOCAL] ${f}`));
}
if (diff.missingRemote.length) {
    diff.missingRemote.forEach(f => console.log(`[NOVO LOCAL] ${f}`));
}
if (!diff.changed.length && !diff.missingLocal.length && !diff.missingRemote.length) {
    console.log('Arquivos na raiz então essencialmente sincronizados (ignorando temporários/scripts).');
} else {
    console.log(`Resumo: ${diff.changed.length} mod, ${diff.missingLocal.length} faltam, ${diff.missingRemote.length} novos`);
}
