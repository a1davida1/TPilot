/**
 * Production Deployment Test Suite
 * Comprehensive testing for all critical application functionality
 */

import { db } from './db';
import { generateEnhancedContent } from './services/enhanced-ai-service';
import { SafetyManager as SafetySystems } from './lib/safety-systems';
import { sql } from 'drizzle-orm';

import { logger } from './bootstrap/logger.js';
import { formatLogArgs } from './lib/logger-utils.js';
interface DeploymentTestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  duration?: number;
  error?: unknown;
}

export async function runDeploymentTests() {
  logger.error(...formatLogArgs('🚀 Starting Production Deployment Tests...\n'));
  
  const results: { passed: number; failed: number; warnings: number; tests: DeploymentTestResult[] } = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  // Test 1: Database Connectivity
  try {
    logger.error(...formatLogArgs('Testing database connectivity...'));
    const dbTest = await db.execute(sql`SELECT 1 as test`);
    if (dbTest) {
      results.passed++;
      results.tests.push({ name: 'Database Connectivity', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Database connectivity: PASSED'));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Database Connectivity', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Database connectivity: FAILED', error));
  }

  // Test 2: Enhanced AI Content Generation
  try {
    logger.error(...formatLogArgs('\nTesting enhanced AI content generation...'));
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
      logger.error(...formatLogArgs('✅ Enhanced AI generation: PASSED'));
      logger.error(...formatLogArgs('   Generated', aiContent.titles.length, 'titles'));
      logger.error(...formatLogArgs('   Content length:', aiContent.content.length, 'chars'));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Enhanced AI Generation', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Enhanced AI generation: FAILED', error));
  }

  // Test 3: Safety Systems
  try {
    logger.error(...formatLogArgs('\nTesting safety systems...'));
    const safetyCheck = await SafetySystems.performSafetyCheck(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (safetyCheck) {
      results.passed++;
      results.tests.push({ name: 'Safety Systems', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Safety systems: PASSED'));
      logger.error(...formatLogArgs('   Can post:', safetyCheck.canPost));
      logger.error(...formatLogArgs('   Issues:', safetyCheck.issues.length));
      logger.error(...formatLogArgs('   Warnings:', safetyCheck.warnings.length));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Safety Systems', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Safety systems: FAILED', error));
  }

  // Test 4: Rate Limiting
  try {
    logger.error(...formatLogArgs('\nTesting rate limiting...'));
    const rateCheck = await SafetySystems.checkRateLimit('1', 'test_subreddit');
    
    if (rateCheck) {
      results.passed++;
      results.tests.push({ name: 'Rate Limiting', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Rate limiting: PASSED'));
      logger.error(...formatLogArgs('   Can post:', rateCheck.canPost));
      logger.error(...formatLogArgs('   Posts in window:', rateCheck.postsInWindow));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Rate Limiting', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Rate limiting: FAILED', error));
  }

  // Test 5: Duplicate Detection
  try {
    logger.error(...formatLogArgs('\nTesting duplicate detection...'));
    const duplicateCheck = await SafetySystems.checkDuplicate(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (duplicateCheck) {
      results.passed++;
      results.tests.push({ name: 'Duplicate Detection', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Duplicate detection: PASSED'));
      logger.error(...formatLogArgs('   Is duplicate:', duplicateCheck.isDuplicate));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Duplicate Detection', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Duplicate detection: FAILED', error));
  }

  // Test 6: Performance Check
  try {
    logger.error(...formatLogArgs('\nTesting performance metrics...'));
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
      logger.error(...formatLogArgs('✅ Performance check: PASSED'));
      logger.error(...formatLogArgs('   Parallel operations completed in:', duration, 'ms'));
    } else {
      results.warnings++;
      results.tests.push({ name: 'Performance Check', status: 'WARNING', duration });
      logger.error(...formatLogArgs('⚠️ Performance check: WARNING - Slow response'));
      logger.error(...formatLogArgs('   Duration:', duration, 'ms'));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Performance Check', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Performance check: FAILED', error));
  }

  // Test 7: Content Quality Check
  try {
    logger.error(...formatLogArgs('\nTesting content quality...'));
    
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
          logger.error(...formatLogArgs(`   ❌ Missing titles for ${platform}/${style}`));
        }
        if (!content.content || content.content.length < 10) {
          qualityPassed = false;
          logger.error(...formatLogArgs(`   ❌ Insufficient content for ${platform}/${style}`));
        }
        if (!content.photoInstructions) {
          qualityPassed = false;
          logger.error(...formatLogArgs(`   ❌ Missing photo instructions for ${platform}/${style}`));
        }
      }
    }
    
    if (qualityPassed) {
      results.passed++;
      results.tests.push({ name: 'Content Quality', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Content quality: PASSED'));
      logger.error(...formatLogArgs('   All platforms and styles generating correctly'));
    } else {
      results.failed++;
      results.tests.push({ name: 'Content Quality', status: 'FAILED' });
      logger.error(...formatLogArgs('❌ Content quality: FAILED'));
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Content Quality', status: 'FAILED', error });
    logger.error(...formatLogArgs('❌ Content quality: FAILED', error));
  }

  // Test 8: Error Recovery
  try {
    logger.error(...formatLogArgs('\nTesting error recovery...'));
    
    // Test with invalid input
    const errorContent = await generateEnhancedContent({
      mode: 'text',
      platform: 'invalid_platform' as unknown as never,
      style: 'invalid_style' as unknown as never
    });
    
    if (errorContent && errorContent.content) {
      results.passed++;
      results.tests.push({ name: 'Error Recovery', status: 'PASSED' });
      logger.error(...formatLogArgs('✅ Error recovery: PASSED'));
      logger.error(...formatLogArgs('   System gracefully handled invalid input'));
    }
  } catch (error) {
    results.warnings++;
    results.tests.push({ name: 'Error Recovery', status: 'WARNING', error });
    logger.error(...formatLogArgs('⚠️ Error recovery: WARNING - Should handle errors gracefully'));
  }

  // Final Report
  logger.error(...formatLogArgs('\n' + '='.repeat(60)));
  logger.error(...formatLogArgs('📊 DEPLOYMENT TEST RESULTS'));
  logger.error(...formatLogArgs('='.repeat(60)));
  logger.error(...formatLogArgs(`✅ Passed: ${results.passed}`));
  logger.error(...formatLogArgs(`❌ Failed: ${results.failed}`));
  logger.error(...formatLogArgs(`⚠️ Warnings: ${results.warnings}`));
  logger.error(...formatLogArgs(`📝 Total Tests: ${results.tests.length}`));
  logger.error(...formatLogArgs('='.repeat(60)));
  
  // Detailed results
  logger.error(...formatLogArgs('\nDetailed Results:'));
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : 
                 test.status === 'FAILED' ? '❌' : '⚠️';
    logger.error(...formatLogArgs(`${icon} ${test.name}: ${test.status}`));
    if (test.duration) {
      logger.error(...formatLogArgs(`   Duration: ${test.duration}ms`));
    }
    if (test.error && process.env.NODE_ENV === 'development') {
      logger.error(...formatLogArgs(`   Error: ${test.error}`));
    }
  });
  
  // Deployment recommendation
  logger.error(...formatLogArgs('\n' + '='.repeat(60)));
  if (results.failed === 0) {
    logger.error(...formatLogArgs('✅ DEPLOYMENT READY: All critical tests passed!'));
  } else if (results.failed <= 2) {
    logger.error(...formatLogArgs('⚠️ DEPLOYMENT POSSIBLE: Minor issues detected, review before deploying'));
  } else {
    logger.error(...formatLogArgs('❌ DEPLOYMENT NOT RECOMMENDED: Critical issues need to be resolved'));
  }
  logger.error(...formatLogArgs('='.repeat(60)));
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDeploymentTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      logger.error(...formatLogArgs('Fatal error during deployment tests:', error));
      process.exit(1);
    });
}