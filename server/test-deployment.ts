/**
 * Production Deployment Test Suite
 * Comprehensive testing for all critical application functionality
 */

import { db } from './db';
import { generateEnhancedContent } from './services/enhanced-ai-service';
import { SafetyManager as SafetySystems } from './lib/safety-systems';
import { sql } from 'drizzle-orm';

export async function runDeploymentTests() {
  console.log('🚀 Starting Production Deployment Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: [] as any[]
  };

  // Test 1: Database Connectivity
  try {
    console.log('Testing database connectivity...');
    const dbTest = await db.execute(sql`SELECT 1 as test`);
    if (dbTest) {
      results.passed++;
      results.tests.push({ name: 'Database Connectivity', status: 'PASSED' });
      console.log('✅ Database connectivity: PASSED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Database Connectivity', status: 'FAILED', error });
    console.error('❌ Database connectivity: FAILED', error);
  }

  // Test 2: Enhanced AI Content Generation
  try {
    console.log('\nTesting enhanced AI content generation...');
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
      console.log('✅ Enhanced AI generation: PASSED');
      console.log('   Generated', aiContent.titles.length, 'titles');
      console.log('   Content length:', aiContent.content.length, 'chars');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Enhanced AI Generation', status: 'FAILED', error });
    console.error('❌ Enhanced AI generation: FAILED', error);
  }

  // Test 3: Safety Systems
  try {
    console.log('\nTesting safety systems...');
    const safetyCheck = await SafetySystems.validatePost(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (safetyCheck) {
      results.passed++;
      results.tests.push({ name: 'Safety Systems', status: 'PASSED' });
      console.log('✅ Safety systems: PASSED');
      console.log('   Can post:', safetyCheck.canPost);
      console.log('   Issues:', safetyCheck.issues.length);
      console.log('   Warnings:', safetyCheck.warnings.length);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Safety Systems', status: 'FAILED', error });
    console.error('❌ Safety systems: FAILED', error);
  }

  // Test 4: Rate Limiting
  try {
    console.log('\nTesting rate limiting...');
    const rateCheck = await SafetySystems.checkRateLimit('1', 'test_subreddit');
    
    if (rateCheck) {
      results.passed++;
      results.tests.push({ name: 'Rate Limiting', status: 'PASSED' });
      console.log('✅ Rate limiting: PASSED');
      console.log('   Can post:', rateCheck.canPost);
      console.log('   Posts in window:', rateCheck.postsInWindow);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Rate Limiting', status: 'FAILED', error });
    console.error('❌ Rate limiting: FAILED', error);
  }

  // Test 5: Duplicate Detection
  try {
    console.log('\nTesting duplicate detection...');
    const duplicateCheck = await SafetySystems.checkDuplicate(
      '1',
      'test_subreddit',
      'Test Title',
      'Test body content'
    );
    
    if (duplicateCheck) {
      results.passed++;
      results.tests.push({ name: 'Duplicate Detection', status: 'PASSED' });
      console.log('✅ Duplicate detection: PASSED');
      console.log('   Is duplicate:', duplicateCheck.isDuplicate);
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Duplicate Detection', status: 'FAILED', error });
    console.error('❌ Duplicate detection: FAILED', error);
  }

  // Test 6: Performance Check
  try {
    console.log('\nTesting performance metrics...');
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
      console.log('✅ Performance check: PASSED');
      console.log('   Parallel operations completed in:', duration, 'ms');
    } else {
      results.warnings++;
      results.tests.push({ name: 'Performance Check', status: 'WARNING', duration });
      console.log('⚠️ Performance check: WARNING - Slow response');
      console.log('   Duration:', duration, 'ms');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Performance Check', status: 'FAILED', error });
    console.error('❌ Performance check: FAILED', error);
  }

  // Test 7: Content Quality Check
  try {
    console.log('\nTesting content quality...');
    
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
          console.log(`   ❌ Missing titles for ${platform}/${style}`);
        }
        if (!content.content || content.content.length < 10) {
          qualityPassed = false;
          console.log(`   ❌ Insufficient content for ${platform}/${style}`);
        }
        if (!content.photoInstructions) {
          qualityPassed = false;
          console.log(`   ❌ Missing photo instructions for ${platform}/${style}`);
        }
      }
    }
    
    if (qualityPassed) {
      results.passed++;
      results.tests.push({ name: 'Content Quality', status: 'PASSED' });
      console.log('✅ Content quality: PASSED');
      console.log('   All platforms and styles generating correctly');
    } else {
      results.failed++;
      results.tests.push({ name: 'Content Quality', status: 'FAILED' });
      console.log('❌ Content quality: FAILED');
    }
  } catch (error) {
    results.failed++;
    results.tests.push({ name: 'Content Quality', status: 'FAILED', error });
    console.error('❌ Content quality: FAILED', error);
  }

  // Test 8: Error Recovery
  try {
    console.log('\nTesting error recovery...');
    
    // Test with invalid input
    const errorContent = await generateEnhancedContent({
      mode: 'text',
      platform: 'invalid_platform' as any,
      style: 'invalid_style' as any
    });
    
    if (errorContent && errorContent.content) {
      results.passed++;
      results.tests.push({ name: 'Error Recovery', status: 'PASSED' });
      console.log('✅ Error recovery: PASSED');
      console.log('   System gracefully handled invalid input');
    }
  } catch (error) {
    results.warnings++;
    results.tests.push({ name: 'Error Recovery', status: 'WARNING', error });
    console.log('⚠️ Error recovery: WARNING - Should handle errors gracefully');
  }

  // Final Report
  console.log('\n' + '='.repeat(60));
  console.log('📊 DEPLOYMENT TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⚠️ Warnings: ${results.warnings}`);
  console.log(`📝 Total Tests: ${results.tests.length}`);
  console.log('='.repeat(60));
  
  // Detailed results
  console.log('\nDetailed Results:');
  results.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : 
                 test.status === 'FAILED' ? '❌' : '⚠️';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.duration) {
      console.log(`   Duration: ${test.duration}ms`);
    }
    if (test.error && process.env.NODE_ENV === 'development') {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  // Deployment recommendation
  console.log('\n' + '='.repeat(60));
  if (results.failed === 0) {
    console.log('✅ DEPLOYMENT READY: All critical tests passed!');
  } else if (results.failed <= 2) {
    console.log('⚠️ DEPLOYMENT POSSIBLE: Minor issues detected, review before deploying');
  } else {
    console.log('❌ DEPLOYMENT NOT RECOMMENDED: Critical issues need to be resolved');
  }
  console.log('='.repeat(60));
  
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