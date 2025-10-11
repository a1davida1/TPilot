/**
 * Database Backup Validation Script
 * Ensures database backups are working correctly
 */

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../server/bootstrap/logger.js';

interface BackupValidation {
  success: boolean;
  timestamp: Date;
  backupFile?: string;
  size?: number;
  tables?: string[];
  rowCounts?: Record<string, number>;
  errors?: string[];
}

async function validateDatabaseBackup(): Promise<BackupValidation> {
  const validation: BackupValidation = {
    success: false,
    timestamp: new Date(),
    errors: []
  };

  try {
    console.log('🔍 Starting database backup validation...');
    
    // 1. Check database connection
    console.log('1. Checking database connection...');
    await db.execute(sql`SELECT 1`);
    console.log('✅ Database connection successful');

    // 2. Get database info
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // 3. Get list of tables and row counts
    console.log('2. Getting table information...');
    const tables = await db.execute(sql`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
    `);
    
    validation.tables = tables.rows.map((r: any) => r.tablename);
    validation.rowCounts = {};
    
    for (const table of validation.tables) {
      const result = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(table)}`);
      validation.rowCounts[table] = parseInt(result.rows[0]?.count || '0');
    }
    
    console.log(`✅ Found ${validation.tables.length} tables with ${Object.values(validation.rowCounts).reduce((a, b) => a + b, 0)} total rows`);

    // 4. Create backup
    console.log('3. Creating database backup...');
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
    
    // Create pg_dump command
    const pgDumpCmd = `pg_dump ${dbUrl} > ${backupFile}`;
    
    try {
      execSync(pgDumpCmd, { stdio: 'pipe' });
      console.log(`✅ Backup created: ${backupFile}`);
    } catch (error) {
      // Try alternative method with explicit connection params
      const urlParts = new URL(dbUrl);
      const pgDumpAlt = `PGPASSWORD=${urlParts.password} pg_dump -h ${urlParts.hostname} -p ${urlParts.port} -U ${urlParts.username} -d ${urlParts.pathname.slice(1)} > ${backupFile}`;
      
      try {
        execSync(pgDumpAlt, { stdio: 'pipe' });
        console.log(`✅ Backup created with alternative method: ${backupFile}`);
      } catch (altError) {
        throw new Error(`Failed to create backup: ${error}`);
      }
    }
    
    validation.backupFile = backupFile;

    // 5. Verify backup file
    console.log('4. Verifying backup file...');
    const stats = await fs.stat(backupFile);
    validation.size = stats.size;
    
    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }
    
    console.log(`✅ Backup file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // 6. Verify backup content
    const backupContent = await fs.readFile(backupFile, 'utf-8');
    const lines = backupContent.split('\n').slice(0, 100); // Check first 100 lines
    
    const hasValidHeader = lines.some(line => 
      line.includes('PostgreSQL database dump') || 
      line.includes('-- PostgreSQL database dump')
    );
    
    if (!hasValidHeader) {
      throw new Error('Backup file does not appear to be a valid PostgreSQL dump');
    }
    
    // Check for CREATE TABLE statements
    const createTables = backupContent.match(/CREATE TABLE/g)?.length || 0;
    console.log(`✅ Found ${createTables} CREATE TABLE statements`);
    
    if (createTables < validation.tables.length * 0.8) {
      validation.errors?.push(`Warning: Expected ~${validation.tables.length} tables but found ${createTables} CREATE statements`);
    }

    // 7. Test restoration (optional - only in test environment)
    if (process.env.NODE_ENV === 'test' || process.env.TEST_RESTORE === 'true') {
      console.log('5. Testing restore capability...');
      const testDbName = `test_restore_${Date.now()}`;
      
      try {
        // Create test database
        execSync(`createdb ${testDbName}`, { stdio: 'pipe' });
        
        // Restore backup to test database
        execSync(`psql ${testDbName} < ${backupFile}`, { stdio: 'pipe' });
        
        // Drop test database
        execSync(`dropdb ${testDbName}`, { stdio: 'pipe' });
        
        console.log('✅ Backup restoration test successful');
      } catch (error) {
        console.log('⚠️ Restoration test skipped or failed (non-critical)');
        validation.errors?.push(`Restoration test failed: ${error}`);
      }
    }

    // 8. Create backup metadata
    const metadataFile = backupFile.replace('.sql', '.json');
    await fs.writeFile(metadataFile, JSON.stringify({
      timestamp: validation.timestamp,
      tables: validation.tables,
      rowCounts: validation.rowCounts,
      size: validation.size,
      checksum: require('crypto').createHash('md5').update(backupContent).digest('hex')
    }, null, 2));
    
    console.log(`✅ Metadata saved: ${metadataFile}`);

    validation.success = true;
    console.log('\n✨ Database backup validation completed successfully!');
    
  } catch (error: any) {
    console.error('❌ Backup validation failed:', error.message);
    validation.errors?.push(error.message);
  }

  // 9. Clean up old backups (keep last 7)
  try {
    const backupDir = path.join(process.cwd(), 'backups');
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.sql'));
    
    if (backupFiles.length > 7) {
      const filesToDelete = backupFiles
        .sort()
        .slice(0, backupFiles.length - 7);
      
      for (const file of filesToDelete) {
        await fs.unlink(path.join(backupDir, file));
        const metaFile = file.replace('.sql', '.json');
        try {
          await fs.unlink(path.join(backupDir, metaFile));
        } catch {}
      }
      
      console.log(`🧹 Cleaned up ${filesToDelete.length} old backup(s)`);
    }
  } catch (error) {
    console.log('⚠️ Failed to clean up old backups:', error);
  }

  return validation;
}

// Run if called directly
if (require.main === module) {
  validateDatabaseBackup()
    .then(result => {
      console.log('\n📊 Validation Summary:');
      console.log('- Success:', result.success ? '✅' : '❌');
      console.log('- Tables:', result.tables?.length || 0);
      console.log('- Total Rows:', Object.values(result.rowCounts || {}).reduce((a, b) => a + b, 0));
      console.log('- Backup Size:', result.size ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A');
      if (result.errors && result.errors.length > 0) {
        console.log('- Errors:', result.errors.join(', '));
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { validateDatabaseBackup };
