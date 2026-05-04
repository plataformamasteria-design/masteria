const archiver = require('archiver');
const fs = require('fs');

const output = fs.createWriteStream('./documentation.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const stats = fs.statSync('./documentation.zip');
  console.log(`✅ ZIP criado com sucesso!`);
  console.log(`   Arquivo: documentation.zip`);
  console.log(`   Tamanho: ${(stats.size / 1024).toFixed(2)}KB`);
  console.log(`   Compressão: 27 arquivos`);
});

archive.on('error', (err) => { throw err; });
archive.pipe(output);
archive.directory('./documentation/', 'documentation');
archive.finalize();
