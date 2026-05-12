const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, './');

const program = ts.createProgram(config.fileNames, config.options);
const allDiagnostics = ts.getPreEmitDiagnostics(program);

let count = 0;
allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    let fileName = diagnostic.file.fileName;
    if (fileName.includes('evolution') || fileName.includes('connection') || fileName.includes('conexoes')) {
        let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
        console.log(`${fileName} (${line + 1},${character + 1}): ${message}`);
        count++;
    }
  }
});
console.log(`Found ${count} related errors.`);
