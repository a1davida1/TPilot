/**
 * Production Deployment Test Suite
 * Comprehensive testing for all critical application functionality
 */

import { db } from './db';
import { generateEnhancedContent } from './services/enhanced-ai-service';
import { SafetyManager as SafetySystems } from './lib/safety-systems';
import { sql } from 'drizzle-orm';

interface DeploymentTestResult {
  name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  duration?: number;
  error?: unknown;
}

export async function runDeploymentTests() {
  console.error('🚀 Starting Production Deployment Tests...\n');
  
  const results: { passed: number; failed: number; warnings: number; tests: DeploymentTestResult[] } = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
  };

  // Test 1: Database Connectivity
  try {
    console.error('Testing database connectivity...');
    const dbTest = await db.execute(sql`SELECT 1 as test`);
    if (dbTest) {
      results.passed++;
      results.tests.push({ name: 'Database Connectivity', status: 'PASSED' });
      console.error('✅ Database connectivity: PASSED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Database Connectivity', status: 'FAILED', error });
    console.error('❌ Database connectivity: FAILED', error);
  }

  // Test 2: Enhanced AI Content Generation
  try {
    console.error('\nTesting enhanced AI content generation...');
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
      console.error('✅ Enhanced AI generation: PASSED');
      console.error('   Generated', aiContent.titles.length, 'titles');
      console.error('   Content length:', aiContent.content.length, 'chars');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Enhanced AI Generation', status: 'FAILED', error });
    console.error('❌ Enhanced AI generation: FAILED', error);
  }

  // Test 3: Safety Systems
  try {
    console.error('\nTesting safety systems...');
    const safetyCheck = await SafetySystems.performSafetyCheck(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (safetyCheck) {
      results.passed++;
      results.tests.push({ name: 'Safety Systems', status: 'PASSED' });
      console.error('✅ Safety systems: PASSED');
      console.error('   Can post:', safetyCheck.canPost);
      console.error('   Issues:', safetyCheck.issues.length);
      console.error('   Warnings:', safetyCheck.warnings.length);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Safety Systems', status: 'FAILED', error });
    console.error('❌ Safety systems: FAILED', error);
  }

  // Test 4: Rate Limiting
  try {
    console.error('\nTesting rate limiting...');
    const rateCheck = await SafetySystems.checkRateLimit('1', 'test_subreddit');
    
    if (rateCheck) {
      results.passed++;
      results.tests.push({ name: 'Rate Limiting', status: 'PASSED' });
      console.error('✅ Rate limiting: PASSED');
      console.error('   Can post:', rateCheck.canPost);
      console.error('   Posts in window:', rateCheck.postsInWindow);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Rate Limiting', status: 'FAILED', error });
    console.error('❌ Rate limiting: FAILED', error);
  }

  // Test 5: Duplicate Detection
  try {
    console.error('\nTesting duplicate detection...');
    const duplicateCheck = await SafetySystems.checkDuplicate(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (duplicateCheck) {
      results.passed++;
      results.tests.push({ name: 'Duplicate Detection', status: 'PASSED' });
      console.error('✅ Duplicate detection: PASSED');
      console.error('   Is duplicate:', duplicateCheck.isDuplicate);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Duplicate Detection', status: 'FAILED', error });
    console.error('❌ Duplicate detection: FAILED', error);
  }

  // Test 6: Performance Check
  try {
    console.error('\nTesting performance metrics...');
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
      console.error('✅ Performance check: PASSED');
      console.error('   Parallel operations completed in:', duration, 'ms');
    } else {
      results.warnings++;
      results.tests.push({ name: 'Performance Check', status: 'WARNING', duration });
      console.error('⚠️ Performance check: WARNING - Slow response');
      console.error('   Duration:', duration, 'ms');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Performance Check', status: 'FAILED', error });
    console.error('❌ Performance check: FAILED', error);
  }

  // Test 7: Content Quality Check
  try {
    console.error('\nTesting content quality...');
    
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
          console.error(`   ❌ Missing titles for ${platform}/${style}`);
        }
        if (!content.content || content.content.length < 10) {
          qualityPassed = false;
          console.error(`   ❌ Insufficient content for ${platform}/${style}`);
        }
        if (!content.photoInstructions) {
          qualityPassed = false;
          console.error(`   ❌ Missing photo instructions for ${platform}/${style}`);
        }
      }
    }
    
    if (qualityPassed) {
      results.passed++;
      results.tests.push({ name: 'Content Quality', status: 'PASSED' });
      console.error('✅ Content quality: PASSED');
      console.error('   All platforms and styles generating correctly');
    } else {
      results.failed++;
      results.tests.push({ name: 'Content Quality', status: 'FAILED' });
      console.error('❌ Content quality: FAILED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Content Quality', status: 'FAILED', error });
    console.error('❌ Content quality: FAILED', error);
  }

  // Test 8: Error Recovery
  try {
    console.error('\nTesting error recovery...');
    
    // Test with invalid input
    const errorContent = await generateEnhancedContent({
      mode: 'text',
      platform: 'invalid_platform' as unknown as never,
      style: 'invalid_style' as unknown as never
    });
    
    if (errorContent && errorContent.content) {
      results.passed++;
      results.tests.push({ name: 'Error Recovery', status: 'PASSED' });
      console.error('✅ Error recovery: PASSED');
      console.error('   System gracefully handled invalid input');
    }
  } catch (error) {
    results.warnings++;
    results.tests.push({ name: 'Error Recovery', status: 'WARNING', error });
    console.error('⚠️ Error recovery: WARNING - Should handle errors gracefully');
  }

  // Final Report
  console.error('\n' + '='.repeat(60));
  console.error('📊 DEPLOYMENT TEST RESULTS');
  console.error('='.repeat(60));
  console.error(`✅ Passed: ${results.passed}`);
  console.error(`❌ Failed: ${results.failed}`);
  console.error(`⚠️ Warnings: ${results.warnings}`);
  console.error(`📝 Total Tests: ${results.tests.length}`);
  console.error('='.repeat(60));
  
  // Detailed results
  console.error('\nDetailed Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : 
                 test.status === 'FAILED' ? '❌' : '⚠️';
    console.error(`${icon} ${test.name}: ${test.status}`);
    if (test.duration) {
      console.error(`   Duration: ${test.duration}ms`);
    }
    if (test.error && process.env.NODE_ENV === 'development') {
      console.error(`   Error: ${test.error}`);
    }
  });
  
  // Deployment recommendation
  console.error('\n' + '='.repeat(60));
  if (results.failed === 0) {
    console.error('✅ DEPLOYMENT READY: All critical tests passed!');
  } else if (results.failed <= 2) {
    console.error('⚠️ DEPLOYMENT POSSIBLE: Minor issues detected, review before deploying');
  } else {
    console.error('❌ DEPLOYMENT NOT RECOMMENDED: Critical issues need to be resolved');
  }
  console.error('='.repeat(60));
  
  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDeploymentTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error during deployment tests:', error);
      process.exit(1);
    });
}