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
  
  const rules = [
    { regex: /process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| ""/g, replace: 'process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"' },
    { regex: /process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| ''/g, replace: 'process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"' },
    { regex: /process\.env\.SUPABASE_SERVICE_ROLE_KEY!/g, replace: '(process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder")' },
    
    { regex: /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY \|\| ""/g, replace: 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"' },
    { regex: /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY \|\| ''/g, replace: 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"' },
    { regex: /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY!/g, replace: '(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")' },

    // catch places without fallback
    { regex: /createClient\(\s*[^,]+,\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*\)/g, replace: 'createClient($1, (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder"))' },
    { regex: /createClient\(\s*[^,]+,\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*\)/g, replace: 'createClient($1, (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"))' }
  ];

  for (const rule of rules) {
    if (rule.regex.test(content)) {
      content = content.replace(rule.regex, rule.replace);
      changed = true;
    }
  }
  
  // also specifically check for `const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;` without fallback
  if (content.match(/const\s+\w+\s*=\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*;/)) {
      content = content.replace(/const\s+(\w+)\s*=\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY\s*;/g, 'const $1 = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder";');
      changed = true;
  }
  if (content.match(/const\s+\w+\s*=\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*;/)) {
      content = content.replace(/const\s+(\w+)\s*=\s*process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY\s*;/g, 'const $1 = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log('Fixed keys in ' + filePath);
  }
});
