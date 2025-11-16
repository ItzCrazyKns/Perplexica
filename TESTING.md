# Testing Documentation for Perplexica

This document describes the automated test suite created to verify all bug fixes and ensure code quality.

## Overview

The test suite was created to verify the comprehensive bug fixes made to the Perplexica codebase, including:
- Critical database operation fixes
- File upload validation improvements
- Error handling enhancements
- Weather API switch statement fixes
- Security vulnerability patches

## Test Framework

- **Framework:** Jest with TypeScript support
- **Testing Library:** @testing-library/react for React components
- **Test Environment:** jsdom for DOM simulation
- **Code Coverage:** Jest coverage reporting

## Running Tests

### Run All Tests
```bash
npm test
```

### Watch Mode (Auto-rerun on Changes)
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### CI/CD Mode
```bash
npm run test:ci
```

## Test Structure

```
src/__tests__/
├── lib/
│   ├── utils/
│   │   └── files.test.ts           # File utility error handling tests
│   ├── searxng.test.ts             # SearXNG API error handling tests
│   └── db/
│       └── migrate.test.ts         # Database migration safety tests
└── app/
    └── api/
        ├── uploads-validation.test.ts  # File upload validation tests
        └── weather-switch.test.ts      # Weather API switch statement tests
```

## Test Coverage

### Critical Bug Fixes Tested

#### 1. File Utility Error Handling (`files.test.ts`)
- ✅ Valid file reading and parsing
- ✅ File not found errors
- ✅ Invalid JSON handling
- ✅ Missing required fields (title)
- ✅ Permission denied errors

#### 2. SearXNG API Error Handling (`searxng.test.ts`)
- ✅ Successful search requests
- ✅ HTTP error responses (4xx, 5xx)
- ✅ Content-type validation
- ✅ Network failures and timeouts
- ✅ Empty/missing results handling
- ✅ Special characters in queries

#### 3. File Upload Validation (`uploads-validation.test.ts`)
- ✅ File extension validation (pdf, docx, txt)
- ✅ Case-insensitive validation
- ✅ Files without extensions
- ✅ Empty files array rejection
- ✅ Null/undefined handling

#### 4. Weather API Switch Statement (`weather-switch.test.ts`)
- ✅ Correct weather conditions for all codes
- ✅ No fall-through between cases (15+ cases tested)
- ✅ Unique values for consecutive cases
- ✅ All critical weather codes: 1, 2, 51, 53, 56, 61, 63, 66, 71, 73, 80, 81, 85, 86, 96

#### 5. Database Migration Safety (`migrate.test.ts`)
- ✅ Single-level JSON parsing
- ✅ Multi-level nested JSON parsing
- ✅ Infinite loop prevention (max 10 attempts)
- ✅ Empty string handling
- ✅ Null/undefined handling
- ✅ Already-parsed object handling

## Coverage Goals

Current coverage thresholds (set in `jest.config.js`):
- **Branches:** 50%
- **Functions:** 50%
- **Lines:** 50%
- **Statements:** 50%

These thresholds will increase as more tests are added.

## Writing New Tests

### Test File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Located in `src/__tests__/` mirroring source structure

### Example Test Template

```typescript
import { functionToTest } from '@/lib/module';

describe('FunctionToTest', () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  it('should handle valid input', () => {
    const result = functionToTest('valid input');
    expect(result).toBe('expected output');
  });

  it('should throw error for invalid input', () => {
    expect(() => functionToTest('invalid')).toThrow('Error message');
  });
});
```

### Mocking Modules

```typescript
// Mock a module
jest.mock('@/lib/module', () => ({
  functionName: jest.fn(),
}));

// Mock fs/path
jest.mock('fs');
jest.mock('path');
```

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: npm run test:ci
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Test Results

After running `npm test`, you should see output like:

```
 PASS  src/__tests__/lib/utils/files.test.ts
 PASS  src/__tests__/lib/searxng.test.ts
 PASS  src/__tests__/app/api/uploads-validation.test.ts
 PASS  src/__tests__/app/api/weather-switch.test.ts
 PASS  src/__tests__/lib/db/migrate.test.ts

Test Suites: 5 passed, 5 total
Tests:       45 passed, 45 total
Snapshots:   0 total
Time:        X.XXXs
```

## Debugging Tests

### Run Specific Test File
```bash
npm test -- files.test.ts
```

### Run Specific Test Case
```bash
npm test -- -t "should handle valid file"
```

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Debug in VSCode
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal"
}
```

## Next Steps

### Recommended Additional Tests
1. **API Integration Tests** - Test actual API endpoints with supertest
2. **React Component Tests** - Test UI components with @testing-library/react
3. **E2E Tests** - Add Playwright or Cypress for end-to-end testing
4. **Performance Tests** - Add benchmark tests for critical paths
5. **Security Tests** - Add tests for XSS, CSRF, injection vulnerabilities

### Adding More Coverage
- Database query tests (Drizzle ORM operations)
- LLM provider integration tests
- Streaming response tests
- File processing tests (PDF, DOCX parsing)
- Configuration management tests

## Troubleshooting

### Common Issues

**Problem:** `Cannot find module '@/lib/...'`
**Solution:** Ensure `jest.config.js` has correct `moduleNameMapper`

**Problem:** `ReferenceError: fetch is not defined`
**Solution:** Mock `global.fetch` as shown in `searxng.test.ts`

**Problem:** Tests timeout
**Solution:** Increase timeout: `jest.setTimeout(10000);`

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure existing tests pass
3. Maintain or increase coverage
4. Document new test patterns

---

**Last Updated:** 2025-11-09
**Test Suite Version:** 1.0.0
**Total Test Coverage:** 5 test suites, 45+ test cases
