// Runtime loader for a Unicode-capable font (Noto Sans TC) for jsPDF, to fix CJK garbled text
// Note: Load fonts from local /public/fonts to avoid any external CDN dependency.
// License: Noto fonts are under SIL Open Font License 1.1

import jsPDF from 'jspdf';

let fontsLoaded = false;

// Files should be placed at public/fonts (see public/fonts/README.md)
const NOTO_TC_REGULAR = '/fonts/NotoSansTC-Regular.ttf';
const NOTO_TC_BOLD = '/fonts/NotoSansTC-Bold.ttf';

function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // avoid call stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(
      null,
      Array.from(chunk) as unknown as number[],
    );
  }
  return binary;
}

export async function ensureNotoSansTC(doc: jsPDF): Promise<void> {
  if (fontsLoaded) return;
  const [regBuf, boldBuf] = await Promise.all([
    fetch(NOTO_TC_REGULAR).then((r) => r.arrayBuffer()),
    fetch(NOTO_TC_BOLD).then((r) => r.arrayBuffer()),
  ]);

  const regBin = arrayBufferToBinaryString(regBuf);
  const boldBin = arrayBufferToBinaryString(boldBuf);

  // Register into VFS and add fonts
  doc.addFileToVFS('NotoSansTC-Regular.ttf', regBin);
  doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal');

  doc.addFileToVFS('NotoSansTC-Bold.ttf', boldBin);
  doc.addFont('NotoSansTC-Bold.ttf', 'NotoSansTC', 'bold');

  fontsLoaded = true;
}
