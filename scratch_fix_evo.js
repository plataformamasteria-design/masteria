const fs = require('fs');
const files = ['src/lib/automation-engine.ts', 'src/lib/flow-engine.ts'];

files.forEach(f => {
  let text = fs.readFileSync(f, 'utf8');
  
  text = text.replace(/connectionData\[0\]\.connectionType === 'baileys'/g, "['baileys', 'evolution'].includes(connectionData[0].connectionType || '')");
  
  text = text.replace(/connectionData\.connectionType === 'baileys'/g, "['baileys', 'evolution'].includes(connectionData.connectionType || '')");
  
  text = text.replace(/resolvedConn\?\.connectionType === 'baileys'/g, "['baileys', 'evolution'].includes(resolvedConn?.connectionType || '')");
  
  text = text.replace(/connection\?\.connectionType === 'baileys'/g, "['baileys', 'evolution'].includes(connection?.connectionType || '')");

  fs.writeFileSync(f, text);
  console.log('Fixed', f);
});
