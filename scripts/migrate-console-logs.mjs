#!/usr/bin/env node
/**
 * Console.log → Winston Logger Migration (Careful Version)
 * 
 * Strategy: Simple string replacement, add imports if needed
 * Avoids complex regex that caused syntax errors
 */

import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Get list of files with console.* 
const { stdout } = await execAsync(
  `find server -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" -exec grep -l "console\\.\\(error\\|warn\\|log\\)" {} \\;`
);

const files = stdout.trim().split('\n').filter(Boolean);

console.log(`📋 Found ${files.length} files with console.* calls\n`);

let filesModified = 0;
let totalReplacements = 0;

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    const originalContent = content;
    let replacements = 0;
    
    // Count occurrences
    const consoleCount = (content.match(/console\.(error|warn|log)\(/g) || []).length;
    
    if (consoleCount === 0) continue;
    
    // Simple replacements - just swap console for logger
    // We'll use logger's built-in formatting instead of formatLogArgs
    // This avoids complex parenthesis matching issues
    
    content = content.replace(/console\.error\(/g, 'logger.error(');
    content = content.replace(/console\.warn\(/g, 'logger.warn(');
    content = content.replace(/console\.log\(/g, 'logger.info(');
    
    replacements = consoleCount;
    
    // Check if imports are needed
    const needsLoggerImport = !content.match(/import.*logger.*from.*bootstrap\/logger/);
    
    if (needsLoggerImport) {
      // Find last import line
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^import /)) {
          lastImportIndex = i;
        }
      }
      
      if (lastImportIndex >= 0) {
        // Calculate relative path to bootstrap/logger.js
        const depth = (file.match(/\//g) || []).length - 1; // -1 for 'server/'
        const prefix = depth > 0 ? '../'.repeat(depth) : './';
        
        lines.splice(lastImportIndex + 1, 0, `import { logger } from '${prefix}bootstrap/logger.js';`);
        content = lines.join('\n');
      }
    }
    
    writeFileSync(file, content, 'utf8');
    
    console.log(`✅ ${file}: ${replacements} replacements`);
    filesModified++;
    totalReplacements += replacements;
    
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);

console.log(`\n🔍 Running typecheck...`);
try {
  await execAsync('npm run typecheck');
  console.log('✅ TypeScript compilation successful!');
} catch (error) {
  console.log('⚠️  TypeScript errors detected - manual review needed');
  console.log(error.stdout);
  process.exit(1);
}
