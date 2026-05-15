const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
      callback(path.join(dir, f));
    }
  });
}

walkDir('./src', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  if (content.includes('NEXT_PUBLIC_SUPABASE_URL || ""')) {
    content = content.replace(/NEXT_PUBLIC_SUPABASE_URL \|\| ""/g, 'NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"');
    changed = true;
  }
  if (content.includes("NEXT_PUBLIC_SUPABASE_URL || ''")) {
    content = content.replace(/NEXT_PUBLIC_SUPABASE_URL \|\| ''/g, 'NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"');
    changed = true;
  }
  if (content.includes('process.env.NEXT_PUBLIC_SUPABASE_URL!')) {
    content = content.replace(/process\.env\.NEXT_PUBLIC_SUPABASE_URL!/g, '(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co")');
    changed = true;
  }
  // Replace import AlertService with named import
  if (content.includes("import AlertService from '@/services/alert.service';")) {
    content = content.replace(/import AlertService from '@\/services\/alert\.service';/g, "import { AlertService } from '@/services/alert.service';");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed ' + filePath);
  }
});
