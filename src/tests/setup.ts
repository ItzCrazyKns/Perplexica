import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Set default timeout for all tests
jest.setTimeout(10000);

// Global setup
beforeAll(() => {
  // Add any global setup here
});

// Global teardown
afterAll(() => {
  // Add any global cleanup here
});

// Reset mocks between tests
afterEach(() => {
  jest.clearAllMocks();
}); 