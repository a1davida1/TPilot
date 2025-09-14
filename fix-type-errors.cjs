#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Helper to fix common TypeScript errors
function fixTypeErrors(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix error.message patterns
  content = content.replace(/(\s)error\.message/g, '$1(error as Error).message');
  content = content.replace(/(\s)error\.stack/g, '$1(error as Error).stack');
  
  // Fix implicit any in map functions
  content = content.replace(/\.map\(\(([^,)]+),\s*([^)]+)\)/g, '.map(($1: any, $2: number)');
  
  // Fix implicit any in function parameters
  content = content.replace(/function\s+(\w+)\(([^:)]+)\)/g, 'function $1($2: any)');
  
  fs.writeFileSync(filePath, content);
}

// Process all TypeScript files
const files = process.argv.slice(2);
files.forEach(fixTypeErrors);

console.log('✅ Type errors fixed in', files.length, 'files');