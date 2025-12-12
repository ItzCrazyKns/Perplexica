import path from 'path';
import fs from 'fs';

export const getFileDetails = (fileId: string) => {
  const uploadsDir = path.join(process.cwd(), './uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.warn(
      `[files] Uploads directory not found while resolving "${fileId}". Returning fallback metadata.`,
    );
    return {
      name: fileId,
      fileId,
    };
  }
  const fileLoc = path.join(uploadsDir, fileId + '-extracted.json');

  if (!fs.existsSync(fileLoc)) {
    console.warn(
      `[files] Extracted data missing for file "${fileId}". Falling back to filename lookup.`,
    );
    const fallbackFileName =
      fs
        .readdirSync(uploadsDir)
        .find((fileName) => fileName.startsWith(fileId)) ?? fileId;

    return {
      name: fallbackFileName,
      fileId,
    };
  }

  let parsedFile: { title?: string } = {};
  try {
    parsedFile = JSON.parse(fs.readFileSync(fileLoc, 'utf8'));
  } catch (error) {
    console.error(
      `[files] Failed to parse extracted file for "${fileId}". Falling back to raw id.`,
      error,
    );
    return {
      name: fileId,
      fileId,
    };
  }

  return {
    name: parsedFile.title ?? fileId,
    fileId: fileId,
  };
};
