import path from 'path';
import fs from 'fs';

export const getFileDetails = (fileId: string) => {
  const safeFileId = path.basename(fileId);
  const fileLoc = path.join(
    process.cwd(),
    './uploads',
    safeFileId + '-extracted.json',
  );

  const parsedFile = JSON.parse(fs.readFileSync(fileLoc, 'utf8'));

  return {
    name: parsedFile.title,
    fileId: fileId,
  };
};
