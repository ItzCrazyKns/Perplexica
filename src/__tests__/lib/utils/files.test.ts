import { getFileDetails } from '@/lib/utils/files';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('getFileDetails', () => {
  const mockFileId = 'test-file-id';
  const mockFilePath = '/mock/path/test-file-id-extracted.json';

  beforeEach(() => {
    jest.clearAllMocks();
    (path.join as jest.Mock).mockReturnValue(mockFilePath);
  });

  it('should return file details for valid file', () => {
    const mockFileContent = JSON.stringify({ title: 'Test File' });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);

    const result = getFileDetails(mockFileId);

    expect(result).toEqual({
      name: 'Test File',
      fileId: mockFileId,
    });
    expect(fs.existsSync).toHaveBeenCalledWith(mockFilePath);
    expect(fs.readFileSync).toHaveBeenCalledWith(mockFilePath, 'utf8');
  });

  it('should throw error when file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    expect(() => getFileDetails(mockFileId)).toThrow(`File not found: ${mockFileId}`);
  });

  it('should throw error for invalid JSON', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

    expect(() => getFileDetails(mockFileId)).toThrow(`Invalid JSON in file: ${mockFileId}`);
  });

  it('should throw error when title field is missing', () => {
    const mockFileContent = JSON.stringify({ content: 'some content' });
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(mockFileContent);

    expect(() => getFileDetails(mockFileId)).toThrow(`Invalid file format: missing title field for ${mockFileId}`);
  });

  it('should handle file read errors gracefully', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    expect(() => getFileDetails(mockFileId)).toThrow('Permission denied');
  });
});
