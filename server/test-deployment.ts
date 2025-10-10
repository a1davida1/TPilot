/**
 * Production Deployment Test Suite
 * Comprehensive testing for all critical application functionality
 */

import { db } from './db';
import { generateEnhancedContent } from './services/enhanced-ai-service';
import { SafetyManager as SafetySystems } from './lib/safety-systems';
import { sql } from 'drizzle-orm';
import { logger } from './bootstrap/logger.js';

interface DeploymentTestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  duration?: number;
  error?: unknown;
}

export async function runDeploymentTests() {
  logger.error('🚀 Starting Production Deployment Tests...\n');
  
  const results: { passed: number; failed: number; warnings: number; tests: DeploymentTestResult[] } = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  // Test 1: Database Connectivity
  try {
    logger.error('Testing database connectivity...');
    const dbTest = await db.execute(sql`SELECT 1 as test`);
    if (dbTest) {
      results.passed++;
      results.tests.push({ name: 'Database Connectivity', status: 'PASSED' });
      logger.error('✅ Database connectivity: PASSED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Database Connectivity', status: 'FAILED', error });
    logger.error('❌ Database connectivity: FAILED', error);
  }

  // Test 2: Enhanced AI Content Generation
  try {
    logger.error('\nTesting enhanced AI content generation...');
    const aiContent = await generateEnhancedContent({
      mode: 'text',
      prompt: 'Test content generation',
      platform: 'reddit',
      style: 'playful',
      theme: 'lifestyle',
      includePromotion: false
    });
    
    if (aiContent && aiContent.titles && aiContent.content) {
      results.passed++;
      results.tests.push({ name: 'Enhanced AI Generation', status: 'PASSED' });
      logger.error('✅ Enhanced AI generation: PASSED');
      logger.error('   Generated', aiContent.titles.length, 'titles');
      logger.error('   Content length:', aiContent.content.length, 'chars');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Enhanced AI Generation', status: 'FAILED', error });
    logger.error('❌ Enhanced AI generation: FAILED', error);
  }

  // Test 3: Safety Systems
  try {
    logger.error('\nTesting safety systems...');
    const safetyCheck = await SafetySystems.performSafetyCheck(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (safetyCheck) {
      results.passed++;
      results.tests.push({ name: 'Safety Systems', status: 'PASSED' });
      logger.error('✅ Safety systems: PASSED');
      logger.error('   Can post:', safetyCheck.canPost);
      logger.error('   Issues:', safetyCheck.issues.length);
      logger.error('   Warnings:', safetyCheck.warnings.length);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Safety Systems', status: 'FAILED', error });
    logger.error('❌ Safety systems: FAILED', error);
  }

  // Test 4: Rate Limiting
  try {
    logger.error('\nTesting rate limiting...');
    const rateCheck = await SafetySystems.checkRateLimit('1', 'test_subreddit');
    
    if (rateCheck) {
      results.passed++;
      results.tests.push({ name: 'Rate Limiting', status: 'PASSED' });
      logger.error('✅ Rate limiting: PASSED');
      logger.error('   Can post:', rateCheck.canPost);
      logger.error('   Posts in window:', rateCheck.postsInWindow);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Rate Limiting', status: 'FAILED', error });
    logger.error('❌ Rate limiting: FAILED', error);
  }

  // Test 5: Duplicate Detection
  try {
    logger.error('\nTesting duplicate detection...');
    const duplicateCheck = await SafetySystems.checkDuplicate(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (duplicateCheck) {
      results.passed++;
      results.tests.push({ name: 'Duplicate Detection', status: 'PASSED' });
      logger.error('✅ Duplicate detection: PASSED');
      logger.error('   Is duplicate:', duplicateCheck.isDuplicate);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Duplicate Detection', status: 'FAILED', error });
    logger.error('❌ Duplicate detection: FAILED', error);
  }

  // Test 6: Performance Check
  try {
    logger.error('\nTesting performance metrics...');
    const startTime = Date.now();
    
    // Parallel test operations
    await Promise.all([
      SafetySystems.checkRateLimit('1', 'perf_test'),
      SafetySystems.checkDuplicate('1', 'perf_test', 'Title', 'Body'),
      generateEnhancedContent({
        mode: 'text',
        prompt: 'Performance test',
        platform: 'reddit',
        style: 'playful'
      })
    ]);
    
    const duration = Date.now() - startTime;
    
    if (duration < 5000) { // Should complete within 5 seconds
      results.passed++;
      results.tests.push({ name: 'Performance Check', status: 'PASSED', duration });
      logger.error('✅ Performance check: PASSED');
      logger.error('   Parallel operations completed in:', duration, 'ms');
    } else {
      results.warnings++;
      results.tests.push({ name: 'Performance Check', status: 'WARNING', duration });
      logger.error('⚠️ Performance check: WARNING - Slow response');
      logger.error('   Duration:', duration, 'ms');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Performance Check', status: 'FAILED', error });
    logger.error('❌ Performance check: FAILED', error);
  }

  // Test 7: Content Quality Check
  try {
    logger.error('\nTesting content quality...');
    
    const platforms = ['reddit', 'twitter', 'instagram', 'tiktok', 'onlyfans'] as const;
    const styles = ['playful', 'mysterious', 'bold', 'elegant', 'confident'] as const;
    
    let qualityPassed = true;
    
    for (const platform of platforms) {
      for (const style of styles) {
        const content = await generateEnhancedContent({
          mode: 'text',
          prompt: `Quality test for ${platform} with ${style} style`,
          platform,
          style,
          includePromotion: true,
          promotionLevel: 'subtle'
        });
        
        // Verify content structure
        if (!content.titles || content.titles.length < 1) {
          qualityPassed = false;
          logger.error(`   ❌ Missing titles for ${platform}/${style}`);
        }
        if (!content.content || content.content.length < 10) {
          qualityPassed = false;
          logger.error(`   ❌ Insufficient content for ${platform}/${style}`);
        }
        if (!content.photoInstructions) {
          qualityPassed = false;
          logger.error(`   ❌ Missing photo instructions for ${platform}/${style}`);
        }
      }
    }
    
    if (qualityPassed) {
      results.passed++;
      results.tests.push({ name: 'Content Quality', status: 'PASSED' });
      logger.error('✅ Content quality: PASSED');
      logger.error('   All platforms and styles generating correctly');
    } else {
      results.failed++;
      results.tests.push({ name: 'Content Quality', status: 'FAILED' });
      logger.error('❌ Content quality: FAILED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Content Quality', status: 'FAILED', error });
    logger.error('❌ Content quality: FAILED', error);
  }

  // Test 8: Error Recovery
  try {
    logger.error('\nTesting error recovery...');
    
    // Test with invalid input
    const errorContent = await generateEnhancedContent({
      mode: 'text',
      platform: 'invalid_platform' as unknown as never,
      style: 'invalid_style' as unknown as never
    });
    
    if (errorContent && errorContent.content) {
      results.passed++;
      results.tests.push({ name: 'Error Recovery', status: 'PASSED' });
      logger.error('✅ Error recovery: PASSED');
      logger.error('   System gracefully handled invalid input');
    }
  } catch (error) {
    results.warnings++;
    results.tests.push({ name: 'Error Recovery', status: 'WARNING', error });
    logger.error('⚠️ Error recovery: WARNING - Should handle errors gracefully');
  }

  // Final Report
  logger.error('\n' + '='.repeat(60));
  logger.error('📊 DEPLOYMENT TEST RESULTS');
  logger.error('='.repeat(60));
  logger.error(`✅ Passed: ${results.passed}`);
  logger.error(`❌ Failed: ${results.failed}`);
  logger.error(`⚠️ Warnings: ${results.warnings}`);
  logger.error(`📝 Total Tests: ${results.tests.length}`);
  logger.error('='.repeat(60));
  
  // Detailed results
  logger.error('\nDetailed Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : 
                 test.status === 'FAILED' ? '❌' : '⚠️';
    logger.error(`${icon} ${test.name}: ${test.status}`);
    if (test.duration) {
      logger.error(`   Duration: ${test.duration}ms`);
    }
    if (test.error && process.env.NODE_ENV === 'development') {
      logger.error(`   Error: ${test.error}`);
    }
  });
  
  // Deployment recommendation
  logger.error('\n' + '='.repeat(60));
  if (results.failed === 0) {
    logger.error('✅ DEPLOYMENT READY: All critical tests passed!');
  } else if (results.failed <= 2) {
    logger.error('⚠️ DEPLOYMENT POSSIBLE: Minor issues detected, review before deploying');
  } else {
    logger.error('❌ DEPLOYMENT NOT RECOMMENDED: Critical issues need to be resolved');
  }
  logger.error('='.repeat(60));
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDeploymentTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      logger.error('Fatal error during deployment tests:', error);
      process.exit(1);
    });
}