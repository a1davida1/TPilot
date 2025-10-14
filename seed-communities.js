#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Seeds the database with Reddit communities if empty
 * Run with: node seed-communities.js
 */

import { db } from './dist/server/db.js';
import { redditCommunities } from './dist/shared/schema.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function seedCommunities() {
  try {
    // Check if communities already exist
    const existing = await db.select().from(redditCommunities).limit(1);
    
    if (existing.length > 0) {
      console.log(`✅ Database already has ${existing.length} communities`);
      return;
    }

    console.log('📦 Loading seed data...');
    
    // Try loading the full dataset first
    let seedData;
    try {
      const fullPath = join(__dirname, 'server', 'seeds', 'reddit-communities-full.json');
      const rawData = await fs.readFile(fullPath, 'utf8');
      seedData = JSON.parse(rawData);
      console.log(`📊 Loaded full dataset with ${seedData.length} communities`);
    } catch {
      // Fallback to smaller dataset
      const basicPath = join(__dirname, 'server', 'seeds', 'reddit-communities.json');
      const rawData = await fs.readFile(basicPath, 'utf8');
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
    process.exit(1);
  }
}

seedCommunities();
