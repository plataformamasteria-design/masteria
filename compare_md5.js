const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const railwaySums = fs.readFileSync('railway_md5.txt', 'utf16le')
    .split('\n')
    .filter(Boolean)
    .reduce((acc, line) => {
        const [md5, ...fileParts] = line.trim().split(/\s+/);
        if (md5 && fileParts.length) {
            acc[fileParts.join(' ').replace('\r', '')] = md5;
        }
        return acc;
    }, {});

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else {
            files.push(name);
        }
    }
    return files;
}

const localFiles = getFiles('src');
const localSums = {};

for (const file of localFiles) {
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    localSums[file] = hash;
}

const diff = {
    missingLocal: [],
    missingRemote: [],
    changed: []
};

for (const [file, remoteSum] of Object.entries(railwaySums)) {
    if (!localSums[file]) {
        diff.missingLocal.push(file);
    } else if (localSums[file] !== remoteSum) {
        diff.changed.push(file);
    }
}

for (const file of Object.keys(localSums)) {
    if (!railwaySums[file]) {
        diff.missingRemote.push(file);
    }
}

console.log('=== RELATÓRIO DE COMPARAÇÃO (SRC) ===');
console.log(`Arquivos no Railway: ${Object.keys(railwaySums).length}`);
console.log(`Arquivos Locais: ${Object.keys(localSums).length}`);
console.log('');

if (diff.changed.length) {
    console.log('=== ARQUIVOS DIFERENTES ===');
    diff.changed.forEach(f => console.log(`[MODIFICADO] ${f}`));
}

if (diff.missingLocal.length) {
    console.log('\n=== ARQUIVOS SOMENTE NO RAILWAY ===');
    diff.missingLocal.forEach(f => console.log(`[FALTANDO LOCAL] ${f}`));
}

if (diff.missingRemote.length) {
    console.log('\n=== ARQUIVOS SOMENTE LOCAL ===');
    diff.missingRemote.forEach(f => console.log(`[NOVO LOCAL] ${f}`));
}

if (diff.changed.length === 0 && diff.missingLocal.length === 0 && diff.missingRemote.length === 0) {
    console.log('A pasta src está exatamete sincronizada (mesmos arquivos e mesmo conteúdo).');
} else {
    console.log(`\nResumo: ${diff.changed.length} modificados, ${diff.missingLocal.length} faltam localmente, ${diff.missingRemote.length} novos locais.`);
}
