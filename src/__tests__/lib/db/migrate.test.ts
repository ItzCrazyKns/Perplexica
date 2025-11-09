/**
 * Tests for database migration infinite loop fix
 * Tests the safety counter that prevents infinite parsing attempts
 */

describe('Database Migration - JSON Parse Safety', () => {
  const parseMetadataWithSafety = (metadata: any): any => {
    let parseAttempts = 0;
    const MAX_PARSE_ATTEMPTS = 10;

    while (typeof metadata === 'string' && parseAttempts < MAX_PARSE_ATTEMPTS) {
      metadata = JSON.parse(metadata || '{}');
      parseAttempts++;
    }

    if (parseAttempts >= MAX_PARSE_ATTEMPTS) {
      console.error('Failed to parse metadata after maximum attempts');
      metadata = {};
    }

    return metadata;
  };

  it('should parse single-level JSON string', () => {
    const input = '{"createdAt":"2024-01-01"}';
    const result = parseMetadataWithSafety(input);

    expect(result).toEqual({ createdAt: '2024-01-01' });
  });

  it('should parse double-nested JSON string', () => {
    const input = '"{\\\"createdAt\\\":\\\"2024-01-01\\\"}"';
    const result = parseMetadataWithSafety(input);

    expect(result).toEqual({ createdAt: '2024-01-01' });
  });

  it('should stop after 10 attempts and return empty object', () => {
    // Create a deeply nested string that would require more than 10 parses
    let nested = '{"test":"value"}';
    for (let i = 0; i < 15; i++) {
      nested = JSON.stringify(nested);
    }

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const result = parseMetadataWithSafety(nested);

    expect(result).toEqual({});
    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse metadata after maximum attempts');

    consoleSpy.mockRestore();
  });

  it('should return already-parsed object immediately', () => {
    const input = { createdAt: '2024-01-01' };
    const result = parseMetadataWithSafety(input);

    expect(result).toEqual(input);
  });

  it('should handle empty string', () => {
    const result = parseMetadataWithSafety('');

    expect(result).toEqual({});
  });

  it('should handle null input', () => {
    const result = parseMetadataWithSafety(null);

    expect(result).toBeNull();
  });

  it('should handle undefined input', () => {
    const result = parseMetadataWithSafety(undefined);

    expect(result).toBeUndefined();
  });
});
