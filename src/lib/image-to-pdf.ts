/**
 * Convert image files (JPG, PNG) to single-page PDF using pdf-lib.
 * Images are embedded at their original size.
 */
import { PDFDocument } from 'pdf-lib';

export async function imageToPdfBuffer(
  imageBuffer: ArrayBuffer,
  mimeType: string,
): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  let image;
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    image = await doc.embedJpg(imageBuffer);
  } else if (mimeType === 'image/png') {
    image = await doc.embedPng(imageBuffer);
  } else {
    throw new Error(`Unsupported image type: ${mimeType}`);
  }

  // A4 size in points: 595.28 x 841.89
  // 横長画像は用紙も横向き（A4ランドスケープ）にして余白を減らす
  const A4_SHORT = 595.28;
  const A4_LONG = 841.89;
  const isLandscape = image.width > image.height;
  const pageW = isLandscape ? A4_LONG : A4_SHORT;
  const pageH = isLandscape ? A4_SHORT : A4_LONG;
  const MARGIN = 36; // 0.5 inch margin

  const maxW = pageW - MARGIN * 2;
  const maxH = pageH - MARGIN * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;

  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  const bytes = await doc.save();
  return bytes.buffer as ArrayBuffer;
}
