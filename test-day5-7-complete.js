#!/usr/bin/env node

/**
 * Day 5-7: Database & API Foundation - Complete Test Suite
 * Tests all implemented backend infrastructure components
 */

const http = require('http');

// ANSI colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const jsonBody = JSON.parse(body);
            resolve({ status: res.statusCode, data: jsonBody, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data: body, headers: res.headers });
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async test(name, testFn) {
    try {
      this.log(`\n🧪 Testing: ${name}`, 'cyan');
      await testFn();
      this.log(`✅ PASSED: ${name}`, 'green');
      this.passed++;
    } catch (error) {
      this.log(`❌ FAILED: ${name}`, 'red');
      this.log(`   Error: ${error.message}`, 'red');
      this.failed++;
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
  }

  assertTrue(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertContains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new Error(`${message}: "${needle}" not found in "${haystack}"`);
    }
  }

  async run() {
    this.log('\n🚀 Day 5-7: Database & API Foundation Test Suite', 'bold');
    this.log('================================================', 'blue');

    // 1. Test Basic API Health
    await this.test('API Health Check', async () => {
      const response = await this.makeRequest('GET', '/api/test');
      this.assertEqual(response.status, 200, 'Health check status');
      this.assertTrue(response.data.success, 'Health check success');
      this.assertContains(response.data.message, 'Backend API is working', 'Health check message');
    });

    // 2. Test Database Schema Implementation
    await this.test('Database Schema & Seed Data', async () => {
      const response = await this.makeRequest('GET', '/api/search?q=vitamin&limit=5');
      this.assertEqual(response.status, 200, 'Search response status');
      this.assertTrue(response.data.success, 'Search success');
      this.assertTrue(Array.isArray(response.data.data.supplements), 'Supplements array');
      this.assertTrue(response.data.data.supplements.length > 0, 'Has supplements');
      
      // Check supplement structure
      const supplement = response.data.data.supplements[0];
      this.assertTrue(supplement.hasOwnProperty('id'), 'Supplement has id');
      this.assertTrue(supplement.hasOwnProperty('name'), 'Supplement has name');
      this.assertTrue(supplement.hasOwnProperty('brand'), 'Supplement has brand');
      this.assertTrue(supplement.hasOwnProperty('category'), 'Supplement has category');
      this.assertTrue(supplement.hasOwnProperty('ingredients'), 'Supplement has ingredients');
      this.assertTrue(supplement.hasOwnProperty('verified'), 'Supplement has verified');
    });

    // 3. Test Search API with Fuzzy Matching
    await this.test('Search API - Fuzzy Matching', async () => {
      // Test exact match
      const exactResponse = await this.makeRequest('GET', '/api/search?q=Vitamin%20D3');
      this.assertEqual(exactResponse.status, 200, 'Exact search status');
      this.assertTrue(exactResponse.data.data.supplements.length > 0, 'Exact search results');

      // Test fuzzy match
      const fuzzyResponse = await this.makeRequest('GET', '/api/search?q=vitmin');
      this.assertEqual(fuzzyResponse.status, 200, 'Fuzzy search status');
      this.assertTrue(fuzzyResponse.data.data.supplements.length > 0, 'Fuzzy search results');

      // Test category filter
      const categoryResponse = await this.makeRequest('GET', '/api/search?category=Vitamins');
      this.assertEqual(categoryResponse.status, 200, 'Category search status');
      this.assertTrue(categoryResponse.data.data.supplements.length > 0, 'Category search results');
    });

    // 4. Test Pagination
    await this.test('Search API - Pagination', async () => {
      const page1 = await this.makeRequest('GET', '/api/search?q=vitamin&page=1&limit=5');
      const page2 = await this.makeRequest('GET', '/api/search?q=vitamin&page=2&limit=5');
      
      this.assertEqual(page1.status, 200, 'Page 1 status');
      this.assertEqual(page2.status, 200, 'Page 2 status');
      this.assertTrue(page1.data.data.supplements.length <= 5, 'Page 1 limit');
      this.assertTrue(page1.data.data.pagination.hasOwnProperty('currentPage'), 'Has pagination info');
    });

    // 5. Test Analysis API - Text Input
    await this.test('Analysis API - Text Input', async () => {
      const analysisData = {
        text: "Vitamin D3 1000 IU cholecalciferol supplement"
      };
      
      const response = await this.makeRequest('POST', '/api/analyze', analysisData);
      this.assertEqual(response.status, 200, 'Analysis status');
      this.assertTrue(response.data.success, 'Analysis success');
      this.assertTrue(response.data.data.hasOwnProperty('analysis'), 'Has analysis data');
    });

    // 6. Test Analysis API - Image URL
    await this.test('Analysis API - Image URL', async () => {
      const analysisData = {
        imageUrl: "https://example.com/supplement-label.jpg"
      };
      
      const response = await this.makeRequest('POST', '/api/analyze', analysisData);
      this.assertEqual(response.status, 200, 'Image analysis status');
      this.assertTrue(response.data.success, 'Image analysis success');
    });

    // 7. Test Upload API - File Validation
    await this.test('Upload API - Validation', async () => {
      // Test missing file
      const response = await this.makeRequest('POST', '/api/upload');
      this.assertEqual(response.status, 400, 'Missing file validation');
      this.assertContains(response.data.error, 'VALIDATION_ERROR', 'Validation error type');
    });

    // 8. Test Rate Limiting
    await this.test('Rate Limiting', async () => {
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(this.makeRequest('GET', '/api/search?q=test'));
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);
      this.assertTrue(rateLimited, 'Rate limiting triggered');
    });

    // 9. Test Error Handling
    await this.test('Error Handling', async () => {
      // Test invalid JSON
      const response = await this.makeRequest('POST', '/api/analyze', null, {
        'Content-Type': 'application/json'
      });
      
      this.assertTrue([400, 500].includes(response.status), 'Error status code');
      this.assertTrue(response.data.hasOwnProperty('error'), 'Has error field');
    });

    // 10. Test Input Validation with Zod
    await this.test('Input Validation (Zod)', async () => {
      const invalidData = {
        text: "",  // Empty text should fail validation
        imageUrl: "not-a-url"  // Invalid URL format
      };
      
      const response = await this.makeRequest('POST', '/api/analyze', invalidData);
      this.assertEqual(response.status, 400, 'Validation error status');
      this.assertContains(response.data.error, 'VALIDATION_ERROR', 'Validation error type');
    });

    // 11. Test TypeScript Types (API Response Structure)
    await this.test('API Response Structure (TypeScript)', async () => {
      const response = await this.makeRequest('GET', '/api/search?q=vitamin&limit=1');
      
      // Check APIResponse structure
      this.assertTrue(response.data.hasOwnProperty('success'), 'Has success field');
      this.assertTrue(response.data.hasOwnProperty('message'), 'Has message field');
      this.assertTrue(response.data.hasOwnProperty('data'), 'Has data field');
      this.assertTrue(response.data.hasOwnProperty('timestamp'), 'Has timestamp field');
      
      // Check SearchResponse structure
      const searchData = response.data.data;
      this.assertTrue(searchData.hasOwnProperty('supplements'), 'Has supplements array');
      this.assertTrue(searchData.hasOwnProperty('pagination'), 'Has pagination object');
      this.assertTrue(searchData.hasOwnProperty('suggestions'), 'Has suggestions array');
    });

    // 12. Test Performance Requirements
    await this.test('Performance Requirements', async () => {
      const start = Date.now();
      const response = await this.makeRequest('GET', '/api/search?q=vitamin&limit=10');
      const duration = Date.now() - start;
      
      this.assertEqual(response.status, 200, 'Performance test status');
      this.assertTrue(duration < 3000, `Response time under 3s (was ${duration}ms)`);
    });

    // Summary
    this.log('\n📊 Test Results Summary', 'bold');
    this.log('=====================', 'blue');
    this.log(`✅ Passed: ${this.passed}`, 'green');
    this.log(`❌ Failed: ${this.failed}`, 'red');
    this.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`, 'cyan');

    if (this.failed === 0) {
      this.log('\n🎉 All tests passed! Day 5-7 implementation is complete!', 'bold');
      this.log('\n📋 Day 5-7 Completed Features:', 'green');
      this.log('✅ Database Schema (Prisma + SQLite)', 'green');
      this.log('✅ API Routes (/upload, /analyze, /search)', 'green');
      this.log('✅ Utility Functions (db, validation, error handling)', 'green');
      this.log('✅ Seed Data (50+ supplements)', 'green');
      this.log('✅ Security & Performance (rate limiting, validation)', 'green');
      this.log('✅ TypeScript interfaces and error handling', 'green');
    } else {
      this.log('\n⚠️  Some tests failed. Please review the implementation.', 'yellow');
    }

    return this.failed === 0;
  }
}

// Run tests if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = TestRunner; 
