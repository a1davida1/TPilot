#!/usr/bin/env tsx

/**
 * Initialize Reddit communities in the database
 * This script can be run during build or manually
 */

import dotenv from 'dotenv';
dotenv.config();

import { db } from '../server/db.js';
import { redditCommunities } from '../shared/schema';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initCommunities() {
  try {
    // Check if communities already exist
    const existing = await db.select().from(redditCommunities).limit(1);
    
    if (existing.length > 0) {
      console.log(`✅ Database already has communities`);
      process.exit(0);
    }

    console.log('📦 Loading seed data...');
    
    // Try loading the full dataset first
    let seedData;
    try {
      const fullPath = join(__dirname, '..', 'server', 'seeds', 'reddit-communities-full.json');
      const rawData = readFileSync(fullPath, 'utf8');
      seedData = JSON.parse(rawData);
      console.log(`📊 Loaded full dataset with ${seedData.length} communities`);
    } catch {
      // Fallback to smaller dataset
      const basicPath = join(__dirname, '..', 'server', 'seeds', 'reddit-communities.json');
      const rawData = readFileSync(basicPath, 'utf8');
      seedData = JSON.parse(rawData);
      console.log(`📊 Loaded basic dataset with ${seedData.length} communities`);
    }

    console.log('💾 Inserting communities into database...');
    await db.insert(redditCommunities).values(seedData).onConflictDoNothing();

    const count = await db.select().from(redditCommunities);
    console.log(`✅ Successfully seeded ${count.length} communities!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding communities:', error);
    // Don't fail the build if seeding fails
    process.exit(0);
  }
}

initCommunities();
