/**
 * Test Environment Setup
 * 
 * Sets up environment variables and configuration for system validation tests.
 * This file is loaded before Jest starts running tests.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DISABLE_EXTERNAL_APIS = 'true';
process.env.TEST_MODE = 'system_validation';
process.env.MOCK_SERVICES = 'true';

// Performance constraints for Jetson Nano Orin
process.env.MAX_MEMORY_MB = '1536';
process.env.MAX_RESPONSE_TIME_MS = '2000';
process.env.MAX_CONCURRENT_REQUESTS = '10';

// Child safety settings
process.env.CHILD_SAFETY_STRICT_MODE = 'true';
process.env.CONTENT_VALIDATION_ENABLED = 'true';
process.env.PARENTAL_CONTROLS_REQUIRED = 'true';

// Privacy settings
process.env.PRIVACY_MODE = 'strict';
process.env.DATA_ENCRYPTION_REQUIRED = 'true';
process.env.LOCAL_PROCESSING_ONLY = 'true';

// Test database settings
process.env.TEST_DB_PATH = './test-data/test.db';
process.env.TEST_CACHE_PATH = './test-data/cache';

// Mock service endpoints
process.env.MOCK_WEATHER_SERVICE = 'http://localhost:3001';
process.env.MOCK_LOCATION_SERVICE = 'http://localhost:3002';
process.env.MOCK_CONTENT_SERVICE = 'http://localhost:3003';

// Disable real integrations during testing
process.env.DISABLE_VOICE_INTEGRATION = 'true';
process.env.DISABLE_AVATAR_INTEGRATION = 'true';
process.env.DISABLE_SMART_HOME_INTEGRATION = 'true';

// Test timing settings
process.env.TEST_TIMEOUT_MS = '300000'; // 5 minutes
process.env.ASYNC_OPERATION_TIMEOUT_MS = '10000'; // 10 seconds

// Logging configuration
process.env.TEST_LOG_FILE = './test-data/logs/system-validation.log';
process.env.PERFORMANCE_LOG_FILE = './test-data/logs/performance.log';

console.log('🔧 Test environment configuration loaded');
console.log(`   Node Environment: ${process.env.NODE_ENV}`);
console.log(`   Memory Limit: ${process.env.MAX_MEMORY_MB}MB`);
console.log(`   Response Time Limit: ${process.env.MAX_RESPONSE_TIME_MS}ms`);
console.log(`   Child Safety Mode: ${process.env.CHILD_SAFETY_STRICT_MODE}`);
console.log(`   Privacy Mode: ${process.env.PRIVACY_MODE}`);