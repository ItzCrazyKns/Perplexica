import path from 'path';
import fs from 'fs';

export const getFileDetails = (fileId: string) => {
  try {
    const fileLoc = path.join(
      process.cwd(),
      './uploads',
      fileId + '-extracted.json',
    );

    if (!fs.existsSync(fileLoc)) {
      throw new Error(`File not found: ${fileId}`);
    }

    const fileContent = fs.readFileSync(fileLoc, 'utf8');
    const parsedFile = JSON.parse(fileContent);

    if (!parsedFile.title) {
      throw new Error(`Invalid file format: missing title field for ${fileId}`);
    }

    return {
      name: parsedFile.title,
      fileId: fileId,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`Error parsing JSON for file ${fileId}:`, error);
      throw new Error(`Invalid JSON in file: ${fileId}`);
    }
    console.error(`Error reading file details for ${fileId}:`, error);
    throw error;
  }
};
