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
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 36; // 0.5 inch margin

  const maxW = A4_WIDTH - MARGIN * 2;
  const maxH = A4_HEIGHT - MARGIN * 2;
  const scale = Math.min(maxW / image.width, maxH / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;

  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(image, {
    x: (A4_WIDTH - drawW) / 2,
    y: (A4_HEIGHT - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  const bytes = await doc.save();
  return bytes.buffer as ArrayBuffer;
}
