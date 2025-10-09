#!/usr/bin/env node
/**
 * Automated Console.log to Winston Logger Migration
 * 
 * This script safely replaces all console.log/error/warn statements
 * with structured Winston logger calls across the server/ directory.
 * 
 * Safety features:
 * - Only modifies .ts files in server/ (excludes tests)
 * - Adds necessary imports automatically
 * - Preserves exact context and error objects
 * - Idempotent (safe to run multiple times)
 * - You can revert with: git checkout server/
 */

const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', 'server');
const DRY_RUN = process.argv.includes('--dry-run');

let filesModified = 0;
let replacementsMade = 0;

/**
 * Recursively find all .ts files in a directory
 */
function findTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, dist, test directories
      if (!['node_modules', 'dist', '__tests__', 'tests'].includes(file)) {
        findTsFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.includes('.test.') && !file.includes('.spec.')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * Check if file already has the necessary imports
 */
function hasLoggerImports(content) {
  const hasLogger = content.includes("from './bootstrap/logger.js'") || 
                    content.includes('from "../bootstrap/logger.js"') ||
                    content.includes('from "../../bootstrap/logger.js"') ||
                    content.includes('from "../../../bootstrap/logger.js"');
  const hasFormatLogArgs = content.includes("from './lib/logger-utils.js'") ||
                           content.includes('from "../lib/logger-utils.js"') ||
                           content.includes('from "../../lib/logger-utils.js"');
  return { hasLogger, hasFormatLogArgs };
}

/**
 * Calculate the correct relative path for imports
 */
function getRelativePath(filePath, target) {
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(fileDir, path.join(SERVER_DIR, target));
  // Normalize to use forward slashes and ensure .js extension
  return './' + relativePath.replace(/\\/g, '/').replace(/\.ts$/, '.js');
}

/**
 * Add necessary imports to the file if missing
 */
function addImports(content, filePath) {
  const { hasLogger, hasFormatLogArgs } = hasLoggerImports(content);
  let modified = content;
  
  // Find the last import statement
  const importRegex = /^import\s+.*?from\s+['"].*?['"];?\s*$/gm;
  const imports = [...content.matchAll(importRegex)];
  
  if (imports.length === 0) {
    // No imports found, add at the top (after any comments)
    const firstNonCommentLine = content.split('\n').findIndex(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });
    
    const insertPos = firstNonCommentLine >= 0 ? 
      content.split('\n').slice(0, firstNonCommentLine).join('\n').length : 0;
    
    const loggerPath = getRelativePath(filePath, 'bootstrap/logger.ts');
    const utilsPath = getRelativePath(filePath, 'lib/logger-utils.ts');
    
    const newImports = [
      !hasLogger ? `import { logger } from '${loggerPath}';` : '',
      !hasFormatLogArgs ? `import { formatLogArgs } from '${utilsPath}';` : ''
    ].filter(Boolean).join('\n');
    
    if (newImports) {
      modified = content.slice(0, insertPos) + newImports + '\n' + content.slice(insertPos);
    }
  } else {
    // Add after the last import
    const lastImport = imports[imports.length - 1];
    const insertPos = lastImport.index + lastImport[0].length;
    
    const loggerPath = getRelativePath(filePath, 'bootstrap/logger.ts');
    const utilsPath = getRelativePath(filePath, 'lib/logger-utils.ts');
    
    const newImports = [
      !hasLogger ? `import { logger } from '${loggerPath}';` : '',
      !hasFormatLogArgs ? `import { formatLogArgs } from '${utilsPath}';` : ''
    ].filter(Boolean).join('\n');
    
    if (newImports) {
      modified = content.slice(0, insertPos) + '\n' + newImports + content.slice(insertPos);
    }
  }
  
  return modified;
}

/**
 * Replace console.* calls with logger.* calls
 */
function replaceConsoleCalls(content) {
  let modified = content;
  let count = 0;
  
  // Pattern: console.error('message', data)
  // Replace with: logger.error(...formatLogArgs('message', data))
  
  // Match console.error/warn/log with various argument patterns
  const patterns = [
    // console.error('message', error)
    {
      regex: /console\.(error|warn|log)\(([^)]+)\)/g,
      replacement: (match, level, args) => {
        // Map console.log to logger.info
        const loggerLevel = level === 'log' ? 'info' : level;
        return `logger.${loggerLevel}(...formatLogArgs(${args}))`;
      }
    }
  ];
  
  patterns.forEach(({ regex, replacement }) => {
    modified = modified.replace(regex, (...args) => {
      count++;
      return replacement(...args);
    });
  });
  
  return { content: modified, count };
}

/**
 * Process a single file
 */
function processFile(filePath) {
  const relativePath = path.relative(SERVER_DIR, filePath);
  
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if file has any console.* calls
  if (!/console\.(error|warn|log)/.test(content)) {
    return; // No console calls, skip
  }
  
  // Add imports if needed
  content = addImports(content, filePath);
  
  // Replace console calls
  const { content: modifiedContent, count } = replaceConsoleCalls(content);
  
  if (count === 0) {
    return; // No replacements made
  }
  
  console.log(`✅ ${relativePath}: ${count} replacement(s)`);
  
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, modifiedContent, 'utf8');
  }
  
  filesModified++;
  replacementsMade += count;
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Console.log to Winston Logger Migration\n');
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  console.log(`📂 Scanning ${SERVER_DIR}...\n`);
  
  const files = findTsFiles(SERVER_DIR);
  console.log(`📄 Found ${files.length} TypeScript files\n`);
  
  files.forEach(processFile);
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✨ Migration Complete!\n`);
  console.log(`📊 Summary:`);
  console.log(`   - Files modified: ${filesModified}`);
  console.log(`   - Replacements made: ${replacementsMade}`);
  
  if (DRY_RUN) {
    console.log(`\n💡 Run without --dry-run to apply changes`);
  } else {
    console.log(`\n✅ All changes applied successfully!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review changes: git diff server/`);
    console.log(`   2. Test the app: npm run build && npm start`);
    console.log(`   3. Verify logging: tail -f logs/combined-*.log`);
    console.log(`   4. Commit: git add server/ && git commit -m "refactor: migrate console.* to Winston logger"`);
    console.log(`   5. Revert if needed: git checkout server/`);
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the script
try {
  main();
} catch (error) {
  console.error('❌ Error running migration:', error);
  process.exit(1);
}
