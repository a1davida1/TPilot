#!/usr/bin/env node

/**
 * Performance Benchmark Suite for ThottoPilot
 * 
 * Tests core platform performance including:
 * - AI content generation (Gemini/OpenAI)
 * - Image processing (ImageShield protection)
 * - Database operations
 * - Upload handling
 * - API endpoint response times
 * 
 * Usage:
 *   npm run perf:benchmark
 *   node scripts/perf/benchmark.js --suite=ai
 *   node scripts/perf/benchmark.js --suite=images --samples=50
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  testUser: {
    email: 'perf-test@example.com',
    password: 'TestPassword123!',
    tier: 'pro'
  },
  samples: {
    default: 10,
    quick: 5,
    thorough: 25
  },
  timeout: 30000, // 30 seconds
  outputDir: './reports/performance'
};

// Benchmark results storage
const results = {
  metadata: {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  },
  tests: []
};

/**
 * Performance test suite runner
 */
class BenchmarkSuite {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.tests = [];
  }

  addTest(name, testFn, options = {}) {
    this.tests.push({
      name,
      testFn,
      samples: options.samples || CONFIG.samples.default,
      warmup: options.warmup || 0,
      timeout: options.timeout || CONFIG.timeout
    });
  }

  async run() {
    console.error(`\n🚀 Running benchmark suite: ${this.name}`);
    console.error(`📝 ${this.description}\n`);

    const suiteResults = {
      suite: this.name,
      description: this.description,
      tests: []
    };

    for (const test of this.tests) {
      console.error(`  Testing: ${test.name}...`);
      
      try {
        const testResult = await this.runTest(test);
        suiteResults.tests.push(testResult);
        
        console.error(`  ✅ ${test.name}: ${testResult.avgMs.toFixed(2)}ms avg (${testResult.samples} samples)`);
      } catch (error) {
        console.error(`  ❌ ${test.name}: ${error.message}`);
        suiteResults.tests.push({
          name: test.name,
          error: error.message,
          failed: true
        });
      }
    }

    results.tests.push(suiteResults);
    return suiteResults;
  }

  async runTest(test) {
    const measurements = [];
    
    // Warmup runs
    for (let i = 0; i < test.warmup; i++) {
      try {
        await Promise.race([
          test.testFn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Warmup timeout')), test.timeout))
        ]);
      } catch (e) {
        // Ignore warmup errors
      }
    }

    // Actual measurements
    for (let i = 0; i < test.samples; i++) {
      const start = performance.now();
      
      try {
        await Promise.race([
          test.testFn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), test.timeout))
        ]);
        
        const end = performance.now();
        measurements.push(end - start);
      } catch (error) {
        throw new Error(`Test failed on sample ${i + 1}: ${error.message}`);
      }
    }

    // Calculate statistics
    const sorted = measurements.sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    
    return {
      name: test.name,
      samples: test.samples,
      avgMs: sum / measurements.length,
      minMs: sorted[0],
      maxMs: sorted[sorted.length - 1],
      medianMs: sorted[Math.floor(sorted.length / 2)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      p99Ms: sorted[Math.floor(sorted.length * 0.99)],
      measurements
    };
  }
}

/**
 * AI Content Generation Benchmarks
 */
const aiSuite = new BenchmarkSuite(
  'AI Content Generation',
  'Tests AI provider response times and content generation performance'
);

aiSuite.addTest('Gemini Text Generation', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/api/caption/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptText: 'Generate a brief social media caption for a fitness photo',
      provider: 'gemini',
      style: 'casual',
      mood: 'energetic'
    })
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}, { samples: 5, warmup: 1 });

aiSuite.addTest('OpenAI Fallback Generation', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/api/caption/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      promptText: 'Generate a brief social media caption for a lifestyle photo',
      provider: 'openai',
      style: 'professional',
      mood: 'confident'
    })
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}, { samples: 3, warmup: 1 });

/**
 * Image Processing Benchmarks
 */
const imageSuite = new BenchmarkSuite(
  'Image Processing',
  'Tests ImageShield protection and image manipulation performance'
);

imageSuite.addTest('ImageShield Light Protection', async () => {
  // Create a test image blob (1x1 pixel PNG)
  const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  const formData = new FormData();
  const response = await fetch(testImageData);
  const blob = await response.blob();
  formData.append('image', blob, 'test.png');
  formData.append('protectionLevel', 'light');
  
  const uploadResponse = await fetch(`${CONFIG.baseUrl}/api/upload/image`, {
    method: 'POST',
    body: formData
  });
  
  if (!uploadResponse.ok) throw new Error(`HTTP ${uploadResponse.status}`);
  return await uploadResponse.json();
}, { samples: 8, warmup: 2 });

imageSuite.addTest('ImageShield Heavy Protection', async () => {
  const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  const formData = new FormData();
  const response = await fetch(testImageData);
  const blob = await response.blob();
  formData.append('image', blob, 'test.png');
  formData.append('protectionLevel', 'heavy');
  
  const uploadResponse = await fetch(`${CONFIG.baseUrl}/api/upload/image`, {
    method: 'POST',
    body: formData
  });
  
  if (!uploadResponse.ok) throw new Error(`HTTP ${uploadResponse.status}`);
  return await uploadResponse.json();
}, { samples: 5, warmup: 1 });

/**
 * Database Operations Benchmarks
 */
const dbSuite = new BenchmarkSuite(
  'Database Operations',
  'Tests database query performance and connection efficiency'
);

dbSuite.addTest('User Authentication Query', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/api/auth/user`, {
    method: 'GET',
    headers: { 'Authorization': 'Bearer test-token' }
  });
  
  // Expect 401 for invalid token, but we're measuring response time
  return response.status;
}, { samples: 15, warmup: 3 });

dbSuite.addTest('Content Generation History Query', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/api/history?limit=10`, {
    method: 'GET'
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}, { samples: 10, warmup: 2 });

/**
 * API Endpoint Benchmarks
 */
const apiSuite = new BenchmarkSuite(
  'API Endpoints',
  'Tests general API response times and server performance'
);

apiSuite.addTest('Health Check Endpoint', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/api/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}, { samples: 20, warmup: 5 });

apiSuite.addTest('Static Asset Serving', async () => {
  const response = await fetch(`${CONFIG.baseUrl}/logo.png`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.status;
}, { samples: 15, warmup: 3 });

/**
 * Report Generation
 */
async function generateReport() {
  // Ensure output directory exists
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  
  // Generate detailed JSON report
  const reportPath = path.join(CONFIG.outputDir, `benchmark-${Date.now()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  // Generate summary report
  const summaryPath = path.join(CONFIG.outputDir, 'benchmark-summary.md');
  const summary = generateMarkdownSummary();
  await fs.writeFile(summaryPath, summary);
  
  console.error(`\n📊 Reports generated:`);
  console.error(`   Detailed: ${reportPath}`);
  console.error(`   Summary:  ${summaryPath}`);
}

function generateMarkdownSummary() {
  let markdown = `# Performance Benchmark Summary\n\n`;
  markdown += `**Generated:** ${results.metadata.timestamp}\n`;
  markdown += `**Platform:** ${results.metadata.platform} ${results.metadata.arch}\n`;
  markdown += `**Node.js:** ${results.metadata.nodeVersion}\n\n`;
  
  for (const suite of results.tests) {
    markdown += `## ${suite.suite}\n\n`;
    markdown += `${suite.description}\n\n`;
    markdown += `| Test | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Samples |\n`;
    markdown += `|------|----------|----------|----------|----------|---------|\n`;
    
    for (const test of suite.tests) {
      if (test.failed) {
        markdown += `| ${test.name} | ❌ FAILED | - | - | - | - |\n`;
      } else {
        markdown += `| ${test.name} | ${test.avgMs.toFixed(2)} | ${test.minMs.toFixed(2)} | ${test.maxMs.toFixed(2)} | ${test.p95Ms.toFixed(2)} | ${test.samples} |\n`;
      }
    }
    markdown += `\n`;
  }
  
  return markdown;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const suiteArg = args.find(arg => arg.startsWith('--suite='))?.split('=')[1];
  const samplesArg = args.find(arg => arg.startsWith('--samples='))?.split('=')[1];
  
  if (samplesArg) {
    const samples = parseInt(samplesArg);
    if (samples > 0 && samples <= 100) {
      CONFIG.samples.default = samples;
    }
  }
  
  console.error('🎯 ThottoPilot Performance Benchmark Suite');
  console.error('==========================================\n');
  console.error(`📍 Target: ${CONFIG.baseUrl}`);
  console.error(`📊 Default samples: ${CONFIG.samples.default}`);
  
  try {
    const suites = {
      ai: [aiSuite],
      images: [imageSuite],
      db: [dbSuite],
      api: [apiSuite],
      all: [aiSuite, imageSuite, dbSuite, apiSuite]
    };
    
    const suitesToRun = suiteArg ? suites[suiteArg] || [suites.all] : suites.all;
    
    if (!suitesToRun) {
      throw new Error(`Unknown suite: ${suiteArg}. Available: ${Object.keys(suites).join(', ')}`);
    }
    
    for (const suite of suitesToRun.flat()) {
      await suite.run();
    }
    
    await generateReport();
    
    console.error('\n✅ Benchmark completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n\n⚠️  Benchmark interrupted by user');
  if (results.tests.length > 0) {
    console.error('📊 Generating partial report...');
    await generateReport();
  }
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BenchmarkSuite, CONFIG, results };