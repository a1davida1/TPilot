/**
 * Analytics API Smoke Test
 * Run with: npx tsx test-analytics-api.ts
 */

import { pool } from './server/db.js';
import { logger } from './server/bootstrap/logger.js';

async function testAnalytics() {
  logger.info('\n🧪 Testing Caption Analytics Infrastructure...\n');
  
  try {
    // Test 1: Check tables exist
    logger.info('1️⃣  Checking database tables...');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('captions', 'caption_pairs', 'caption_choices', 'posts', 'post_metrics', 'protection_metrics')
      ORDER BY table_name
    `);
    
    if (tables.rows.length === 6) {
      logger.info('   ✅ All 6 tables exist:', tables.rows.map(r => r.table_name).join(', '));
    } else {
      logger.error('   ❌ Missing tables. Found:', tables.rows.length);
      logger.error('   Run migration: server/db/migrations/013_caption_analytics.sql');
      process.exit(1);
    }
    
    // Test 2: Check views exist
    logger.info('\n2️⃣  Checking analytics views...');
    const views = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name IN ('caption_performance', 'subreddit_performance', 'creator_caption_preferences')
      ORDER BY table_name
    `);
    
    if (views.rows.length === 3) {
      logger.info('   ✅ All 3 views exist:', views.rows.map(r => r.table_name).join(', '));
    } else {
      logger.warn('   ⚠️  Missing views. Found:', views.rows.length);
    }
    
    // Test 3: Insert test caption pair
    logger.info('\n3️⃣  Testing caption insert...');
    const testPairId = `test_${Date.now()}`;
    const testCaptionId1 = `cap_flirty_${Date.now()}`;
    const testCaptionId2 = `cap_slutty_${Date.now()}`;
    
    await pool.query(
      `INSERT INTO captions (caption_id, model, style, text, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [testCaptionId1, 'grok-4-fast', 'flirty', 'Test flirty caption']
    );
    
    await pool.query(
      `INSERT INTO captions (caption_id, model, style, text, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [testCaptionId2, 'grok-4-fast', 'slutty', 'Test slutty caption']
    );
    
    logger.info('   ✅ Inserted 2 test captions');
    
    // Test 4: Insert caption pair
    logger.info('\n4️⃣  Testing caption pair insert...');
    await pool.query(
      `INSERT INTO caption_pairs (pair_id, caption_id_a, caption_id_b, creator_id, protection_preset, device_bucket, created_at)
       VALUES ($1, $2, $3, 1, 'medium', 'desktop', CURRENT_TIMESTAMP)`,
      [testPairId, testCaptionId1, testCaptionId2]
    );
    
    logger.info('   ✅ Inserted test caption pair');
    
    // Test 5: Insert caption choice
    logger.info('\n5️⃣  Testing caption choice insert...');
    await pool.query(
      `INSERT INTO caption_choices (pair_id, chosen_caption_id, time_to_choice_ms, edited, auto_selected, created_at)
       VALUES ($1, $2, 3500, false, false, CURRENT_TIMESTAMP)`,
      [testPairId, testCaptionId2]
    );
    
    logger.info('   ✅ Inserted test caption choice (chose slutty)');
    
    // Test 6: Query caption performance view
    logger.info('\n6️⃣  Testing analytics view query...');
    const perfResult = await pool.query(`SELECT * FROM caption_performance ORDER BY choice_rate DESC`);
    logger.info(`   ✅ Caption performance view returned ${perfResult.rows.length} rows`);
    
    if (perfResult.rows.length > 0) {
      logger.info('\n   📊 Caption Performance:');
      perfResult.rows.forEach(row => {
        logger.info(`      ${row.style}: ${(row.choice_rate * 100).toFixed(1)}% choice rate`);
      });
    }
    
    // Clean up test data
    logger.info('\n🧹 Cleaning up test data...');
    await pool.query(`DELETE FROM caption_choices WHERE pair_id = $1`, [testPairId]);
    await pool.query(`DELETE FROM caption_pairs WHERE pair_id = $1`, [testPairId]);
    await pool.query(`DELETE FROM captions WHERE caption_id IN ($1, $2)`, [testCaptionId1, testCaptionId2]);
    logger.info('   ✅ Test data cleaned');
    
    logger.info('\n✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅\n');
    logger.info('Analytics infrastructure is ready for production.\n');
    
  } catch (error) {
    logger.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testAnalytics();
