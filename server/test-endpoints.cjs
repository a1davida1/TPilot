/* eslint-env node */
// Test Suite for ThottoPilot Critical Endpoints
const axios = require('axios');

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testPassword123';
let authToken = null;
let sessionCookie = null;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Test result tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Critical endpoints to test
const criticalEndpoints = [
  // Health Check
  { 
    name: 'Health Check',
    path: '/api/health', 
    method: 'GET',
    expectedStatus: 200,
    critical: true
  },
  
  // Auth Endpoints
  { 
    name: 'User Signup',
    path: '/api/auth/signup', 
    method: 'POST', 
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, username: 'testuser' },
    expectedStatus: [200, 201, 409], // 409 if user exists
    critical: true
  },
  { 
    name: 'User Login',
    path: '/api/auth/login', 
    method: 'POST', 
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    expectedStatus: 200,
    saveAuth: true,
    critical: true
  },
  { 
    name: 'Get Current User',
    path: '/api/auth/user', 
    method: 'GET', 
    requiresAuth: true,
    expectedStatus: 200,
    critical: true
  },
  { 
    name: 'User Logout',
    path: '/api/auth/logout', 
    method: 'POST',
    requiresAuth: true,
    expectedStatus: 200
  },
  
  // Content Generation
  { 
    name: 'Generate Content',
    path: '/api/generate-content', 
    method: 'POST', 
    requiresAuth: true,
    body: { 
      platform: 'reddit', 
      style: 'playful', 
      theme: 'lingerie',
      allowsPromotion: 'yes'
    },
    expectedStatus: 200,
    critical: true
  },
  { 
    name: 'Generate Caption',
    path: '/api/caption/generate', 
    method: 'POST', 
    requiresAuth: true,
    body: {
      style: 'playful',
      mood: 'confident'
    },
    expectedStatus: 200
  },
  
  // Reddit Integration
  { 
    name: 'Get Reddit Accounts',
    path: '/api/reddit/accounts', 
    method: 'GET', 
    requiresAuth: true,
    expectedStatus: [200, 304]
  },
  { 
    name: 'Reddit Connect URL',
    path: '/api/reddit/connect', 
    method: 'GET',
    requiresAuth: true,
    expectedStatus: [200, 503] // 503 if not configured
  },
  { 
    name: 'Reddit Communities',
    path: '/api/reddit/communities', 
    method: 'GET',
    expectedStatus: 200
  },
  
  // User Stats
  { 
    name: 'User Statistics',
    path: '/api/user-stats', 
    method: 'GET', 
    requiresAuth: true,
    expectedStatus: 200
  },
  
  // Analytics
  { 
    name: 'Analytics Events',
    path: '/api/analytics/events', 
    method: 'POST',
    body: {
      events: [
        { type: 'page_view', page: '/test' }
      ]
    },
    expectedStatus: 200
  },
  
  // Billing (if configured)
  { 
    name: 'Billing Subscription',
    path: '/api/billing/subscription', 
    method: 'GET', 
    requiresAuth: true,
    expectedStatus: [200, 401, 503] // 503 if Stripe not configured
  },
  
  // Pro Features
  { 
    name: 'Pro Perks',
    path: '/api/pro-perks', 
    method: 'GET',
    expectedStatus: 200
  },
  
  // Templates
  { 
    name: 'Get Templates',
    path: '/api/templates', 
    method: 'GET',
    expectedStatus: 200
  }
];

// Helper function to make requests
async function makeRequest(endpoint) {
  const config = {
    method: endpoint.method,
    url: `${BASE_URL}${endpoint.path}`,
    headers: {},
    validateStatus: () => true // Don't throw on any status
  };

  if (endpoint.body) {
    config.data = endpoint.body;
    config.headers['Content-Type'] = 'application/json';
  }

  if (endpoint.requiresAuth && authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (sessionCookie) {
    config.headers['Cookie'] = sessionCookie;
  }

  try {
    const response = await axios(config);
    
    // Save auth token if needed
    if (endpoint.saveAuth && response.data) {
      if (response.data.token) {
        authToken = response.data.token;
      }
      if (response.headers['set-cookie']) {
        sessionCookie = response.headers['set-cookie'].join('; ');
      }
    }
    
    return response;
  } catch (error) {
    return {
      status: error.response?.status || 0,
      statusText: error.message,
      data: error.response?.data || null
    };
  }
}

// Test runner
async function runTests() {
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     ThottoPilot Endpoint Test Suite${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`Testing against: ${BASE_URL}\n`);

  for (const endpoint of criticalEndpoints) {
    process.stdout.write(`Testing ${endpoint.name}... `);
    
    const response = await makeRequest(endpoint);
    const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
      ? endpoint.expectedStatus 
      : [endpoint.expectedStatus];
    
    if (expectedStatuses.includes(response.status)) {
      console.log(`${colors.green}✓ PASS${colors.reset} (${response.status})`);
      results.passed++;
    } else {
      const errorMsg = `Expected ${expectedStatuses.join(' or ')}, got ${response.status}`;
      console.log(`${colors.red}✗ FAIL${colors.reset} - ${errorMsg}`);
      results.failed++;
      results.errors.push({
        endpoint: endpoint.name,
        error: errorMsg,
        response: response.data
      });
      
      // If critical endpoint fails, warn
      if (endpoint.critical) {
        console.log(`  ${colors.yellow}⚠ CRITICAL ENDPOINT FAILURE${colors.reset}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}                Test Summary${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  
  if (results.errors.length > 0) {
    console.log(`\n${colors.red}Failed Endpoints:${colors.reset}`);
    results.errors.forEach(error => {
      console.log(`  - ${error.endpoint}: ${error.error}`);
      if (error.response && error.response.message) {
        console.log(`    Response: ${error.response.message}`);
      }
    });
  }
  
  // Performance metrics
  console.log(`\n${colors.blue}Performance Metrics:${colors.reset}`);
  console.log(`  Total Tests: ${results.passed + results.failed}`);
  console.log(`  Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  // Exit code based on results
  const exitCode = results.failed > 0 ? 1 : 0;
  console.log(`\n${colors.blue}Exit Code: ${exitCode}${colors.reset}\n`);
  
  return exitCode;
}

// Run tests
runTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error(`${colors.red}Test suite error:${colors.reset}`, error);
  process.exit(1);
});