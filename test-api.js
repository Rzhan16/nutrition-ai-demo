/**
 * Comprehensive API testing script
 * Tests all endpoints with various scenarios
 */

const API_BASE = 'http://localhost:3000'

// Test utilities
function logTest(testName, status, details = '') {
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️'
  console.log(`${statusIcon} ${testName}${details ? ` - ${details}` : ''}`)
}

async function makeRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    })
    
    const data = await response.json()
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries())
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: { error: error.message },
      headers: {}
    }
  }
}

// Test functions
async function testUploadEndpoint() {
  console.log('\n📤 Testing Upload Endpoint...')
  
  // Test GET /api/upload (upload info)
  const infoResponse = await makeRequest('/api/upload')
  if (infoResponse.ok && infoResponse.data.success) {
    logTest('GET /api/upload', 'PASS', 'Upload info retrieved')
  } else {
    logTest('GET /api/upload', 'FAIL', infoResponse.data.error)
  }
  
  // Test POST /api/upload with invalid data
  const invalidResponse = await makeRequest('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ invalid: 'data' })
  })
  
  if (!invalidResponse.ok && invalidResponse.data.error) {
    logTest('POST /api/upload (invalid)', 'PASS', 'Properly rejected invalid data')
  } else {
    logTest('POST /api/upload (invalid)', 'FAIL', 'Should have rejected invalid data')
  }
}

async function testAnalyzeEndpoint() {
  console.log('\n🔍 Testing Analyze Endpoint...')
  
  // Test text analysis
  const textAnalysisResponse = await makeRequest('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({
      text: 'Vitamin D3 1000 IU\nSupplement Facts\nServing Size: 1 capsule'
    })
  })
  
  if (textAnalysisResponse.ok && textAnalysisResponse.data.success) {
    logTest('POST /api/analyze (text)', 'PASS', 'Text analysis completed')
  } else {
    logTest('POST /api/analyze (text)', 'FAIL', textAnalysisResponse.data.error)
  }
  
  // Test image analysis (with mock URL)
  const imageAnalysisResponse = await makeRequest('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({
      imageUrl: 'https://example.com/supplement.jpg',
      userId: 'test_user_001'
    })
  })
  
  if (imageAnalysisResponse.ok && imageAnalysisResponse.data.success) {
    logTest('POST /api/analyze (image)', 'PASS', 'Image analysis completed')
  } else {
    logTest('POST /api/analyze (image)', 'FAIL', imageAnalysisResponse.data.error)
  }
  
  // Test invalid analysis request
  const invalidAnalysisResponse = await makeRequest('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({})
  })
  
  if (!invalidAnalysisResponse.ok) {
    logTest('POST /api/analyze (invalid)', 'PASS', 'Properly rejected invalid request')
  } else {
    logTest('POST /api/analyze (invalid)', 'FAIL', 'Should have rejected invalid request')
  }
  
  // Test scan history
  const historyResponse = await makeRequest('/api/analyze?userId=test_user_001')
  
  if (historyResponse.ok && historyResponse.data.success) {
    logTest('GET /api/analyze (history)', 'PASS', 'Scan history retrieved')
  } else {
    logTest('GET /api/analyze (history)', 'FAIL', historyResponse.data.error)
  }
}

async function testSearchEndpoint() {
  console.log('\n🔎 Testing Search Endpoint...')
  
  // Test basic search
  const basicSearchResponse = await makeRequest('/api/search?q=vitamin')
  
  if (basicSearchResponse.ok && basicSearchResponse.data.success) {
    const resultCount = basicSearchResponse.data.data?.supplements?.length || 0
    logTest('GET /api/search (basic)', 'PASS', `Found ${resultCount} results`)
  } else {
    logTest('GET /api/search (basic)', 'FAIL', basicSearchResponse.data.error)
  }
  
  // Test search with filters
  const filteredSearchResponse = await makeRequest('/api/search?q=vitamin&category=Vitamins&brand=Pure Encapsulations')
  
  if (filteredSearchResponse.ok && filteredSearchResponse.data.success) {
    const resultCount = filteredSearchResponse.data.data?.supplements?.length || 0
    logTest('GET /api/search (filtered)', 'PASS', `Found ${resultCount} filtered results`)
  } else {
    logTest('GET /api/search (filtered)', 'FAIL', filteredSearchResponse.data.error)
  }
  
  // Test advanced search
  const advancedSearchResponse = await makeRequest('/api/search', {
    method: 'POST',
    body: JSON.stringify({
      query: 'omega',
      filters: {
        category: ['Omega-3'],
        verified: true
      },
      sortBy: 'name',
      sortOrder: 'asc',
      page: 1,
      limit: 5
    })
  })
  
  if (advancedSearchResponse.ok && advancedSearchResponse.data.success) {
    const resultCount = advancedSearchResponse.data.data?.supplements?.length || 0
    logTest('POST /api/search (advanced)', 'PASS', `Found ${resultCount} advanced results`)
  } else {
    logTest('POST /api/search (advanced)', 'FAIL', advancedSearchResponse.data.error)
  }
  
  // Test empty search
  const emptySearchResponse = await makeRequest('/api/search?q=')
  
  if (!emptySearchResponse.ok) {
    logTest('GET /api/search (empty)', 'PASS', 'Properly rejected empty search')
  } else {
    logTest('GET /api/search (empty)', 'FAIL', 'Should have rejected empty search')
  }
}

async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting...')
  
  // Make multiple rapid requests to test rate limiting
  const promises = []
  for (let i = 0; i < 15; i++) {
    promises.push(makeRequest('/api/search?q=test'))
  }
  
  const responses = await Promise.all(promises)
  const rateLimited = responses.some(r => r.status === 429)
  
  if (rateLimited) {
    logTest('Rate Limiting', 'PASS', 'Rate limiting is working')
  } else {
    logTest('Rate Limiting', 'WARN', 'Rate limiting may not be working (or limits are high)')
  }
}

async function testErrorHandling() {
  console.log('\n🚨 Testing Error Handling...')
  
  // Test 404
  const notFoundResponse = await makeRequest('/api/nonexistent')
  if (notFoundResponse.status === 404) {
    logTest('404 Error Handling', 'PASS', 'Proper 404 response')
  } else {
    logTest('404 Error Handling', 'FAIL', `Expected 404, got ${notFoundResponse.status}`)
  }
  
  // Test validation errors
  const validationResponse = await makeRequest('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ invalidField: 'test' })
  })
  
  if (!validationResponse.ok && validationResponse.data.error === 'VALIDATION_ERROR') {
    logTest('Validation Error Handling', 'PASS', 'Proper validation error response')
  } else {
    logTest('Validation Error Handling', 'FAIL', 'Should have returned validation error')
  }
}

async function testDatabaseIntegration() {
  console.log('\n🗄️ Testing Database Integration...')
  
  // Test that we can retrieve supplements from the database
  const searchResponse = await makeRequest('/api/search?q=vitamin&limit=1')
  
  if (searchResponse.ok && searchResponse.data.success) {
    const supplements = searchResponse.data.data?.supplements || []
    if (supplements.length > 0) {
      const supplement = supplements[0]
      if (supplement.id && supplement.name && supplement.brand) {
        logTest('Database Integration', 'PASS', 'Successfully retrieved supplement data')
      } else {
        logTest('Database Integration', 'FAIL', 'Supplement data structure incomplete')
      }
    } else {
      logTest('Database Integration', 'FAIL', 'No supplements found in database')
    }
  } else {
    logTest('Database Integration', 'FAIL', 'Failed to query database')
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 Starting API Tests...')
  console.log(`Testing against: ${API_BASE}`)
  
  try {
    await testUploadEndpoint()
    await testAnalyzeEndpoint()
    await testSearchEndpoint()
    await testRateLimiting()
    await testErrorHandling()
    await testDatabaseIntegration()
    
    console.log('\n🎉 All tests completed!')
    console.log('\n📊 Test Summary:')
    console.log('- Upload endpoint: Image processing and validation')
    console.log('- Analyze endpoint: OCR and AI analysis (mock)')
    console.log('- Search endpoint: Database queries and filtering')
    console.log('- Rate limiting: Request throttling')
    console.log('- Error handling: Proper error responses')
    console.log('- Database integration: Data persistence')
    
  } catch (error) {
    console.error('\n💥 Test runner error:', error)
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runAllTests()
}

module.exports = {
  runAllTests,
  testUploadEndpoint,
  testAnalyzeEndpoint,
  testSearchEndpoint,
  testRateLimiting,
  testErrorHandling,
  testDatabaseIntegration
}