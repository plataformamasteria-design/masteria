#!/usr/bin/env tsx

/**
 * Script to automatically apply rate limiting to API routes
 * Usage: tsx scripts/apply-rate-limiting.ts
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const RATE_LIMIT_IMPORT = `import { withRateLimit } from '@/middleware/rate-limit.middleware';`;

async function processRouteFile(filePath: string): Promise<boolean> {
  try {
    let content = await readFile(filePath, 'utf-8');
    
    // Skip if already has rate limiting
    if (content.includes('withRateLimit')) {
      console.log(`✓ ${filePath} already has rate limiting`);
      return false;
    }
    
    // Skip if no exported handlers
    if (!content.match(/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/)) {
      console.log(`⊘ ${filePath} has no exported handlers`);
      return false;
    }
    
    // Add import if not present
    if (!content.includes(RATE_LIMIT_IMPORT)) {
      // Find the last import statement
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImport = content.indexOf('\n', lastImportIndex);
        content = 
          content.slice(0, endOfImport + 1) +
          RATE_LIMIT_IMPORT + '\n' +
          content.slice(endOfImport + 1);
      } else {
        // No imports, add at the beginning
        content = RATE_LIMIT_IMPORT + '\n\n' + content;
      }
    }
    
    // Replace exported functions with rate-limited versions
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    let modified = false;
    
    for (const method of methods) {
      // Pattern 1: export async function METHOD(
      const pattern1 = new RegExp(
        `export\\s+async\\s+function\\s+${method}\\s*\\(`,
        'g'
      );
      if (content.match(pattern1)) {
        content = content.replace(pattern1, `async function ${method}Handler(`);
        content += `\n\n// Apply rate limiting\nexport const ${method} = withRateLimit(${method}Handler);`;
        modified = true;
      }
      
      // Pattern 2: export function METHOD(
      const pattern2 = new RegExp(
        `export\\s+function\\s+${method}\\s*\\(`,
        'g'
      );
      if (content.match(pattern2)) {
        content = content.replace(pattern2, `function ${method}Handler(`);
        content += `\n\n// Apply rate limiting\nexport const ${method} = withRateLimit(${method}Handler);`;
        modified = true;
      }
      
      // Pattern 3: export const METHOD = async (
      const pattern3 = new RegExp(
        `export\\s+const\\s+${method}\\s*=\\s*async\\s*\\(`,
        'g'
      );
      if (content.match(pattern3)) {
        content = content.replace(pattern3, `const ${method}Handler = async (`);
        content += `\n\n// Apply rate limiting\nexport const ${method} = withRateLimit(${method}Handler);`;
        modified = true;
      }
    }
    
    if (modified) {
      await writeFile(filePath, content, 'utf-8');
      console.log(`✅ Applied rate limiting to ${filePath}`);
      return true;
    }
    
    console.log(`⊘ ${filePath} - no modifications needed`);
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

async function findRouteFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search directories
        const subFiles = await findRouteFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name === 'route.ts') {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

async function main() {
  console.log('🚀 Applying rate limiting to API routes...\n');
  
  // Find all route files in API directories
  const apiDirs = [
    'src/app/api/v1',
    'src/app/api/auth',
  ];
  
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  for (const dir of apiDirs) {
    console.log(`\n📁 Processing ${dir}...`);
    const files = await findRouteFiles(dir);
    
    for (const file of files) {
      totalFiles++;
      const modified = await processRouteFile(file);
      if (modified) modifiedFiles++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✨ Rate limiting application complete!`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files modified: ${modifiedFiles}`);
  console.log('='.repeat(50));
  
  if (modifiedFiles > 0) {
    console.log('\n⚠️  Remember to:');
    console.log('   1. Test the modified endpoints');
    console.log('   2. Adjust rate limits if needed in src/lib/rate-limiter.ts');
    console.log('   3. Monitor for 429 errors in production');
  }
}

main().catch(console.error);