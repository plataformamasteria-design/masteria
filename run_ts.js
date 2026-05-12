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
  if (count >= 20) return; // limit to first 20
  count++;
  if (diagnostic.file) {
    let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  }
});

if (count === 0) {
  console.log("No TypeScript errors found!");
} else {
  console.log(`\nFound ${allDiagnostics.length} total errors, showing first ${Math.min(count, 20)}.`);
}
