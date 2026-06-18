import type { PDFDocument, PDFPage } from 'pdf-lib';
import type { OutputSettings } from '@/types/pdf';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const A4_TOLERANCE = 6;
const EXACT_SIZE_TOLERANCE = 0.01;

function getA4SizeFor(width: number, height: number): [number, number] {
  return width > height ? [A4_HEIGHT, A4_WIDTH] : [A4_WIDTH, A4_HEIGHT];
}

function isNear(value: number, target: number): boolean {
  return Math.abs(value - target) <= A4_TOLERANCE;
}

function isA4Size(width: number, height: number): boolean {
  const [targetWidth, targetHeight] = getA4SizeFor(width, height);
  return isNear(width, targetWidth) && isNear(height, targetHeight);
}

function setExactA4Size(page: PDFPage, targetWidth: number, targetHeight: number): void {
  const { width, height } = page.getSize();
  if (
    Math.abs(width - targetWidth) > EXACT_SIZE_TOLERANCE ||
    Math.abs(height - targetHeight) > EXACT_SIZE_TOLERANCE
  ) {
    page.setSize(targetWidth, targetHeight);
  }
}

/**
 * A4統一出力用。A4以外のページはA4用紙へ縮小して中央配置する。
 * 戻り値が true の場合、対象ページはA4サイズへ縮小配置される。
 */
export async function normalizePageToA4IfNeeded(
  pdfDoc: PDFDocument,
  pageIndex: number,
  outputSettings?: OutputSettings,
): Promise<boolean> {
  if (outputSettings?.pageSizeMode !== 'a4') return false;

  const page = pdfDoc.getPage(pageIndex);
  const { width, height } = page.getSize();
  const [targetWidth, targetHeight] = getA4SizeFor(width, height);

  if (isA4Size(width, height)) {
    setExactA4Size(page, targetWidth, targetHeight);
    return false;
  }

  const scale = Math.min(targetWidth / width, targetHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (targetWidth - drawWidth) / 2;
  const y = (targetHeight - drawHeight) / 2;

  page.scaleContent(scale, scale);
  page.scaleAnnotations(scale, scale);
  page.setSize(targetWidth, targetHeight);
  page.translateContent(x, y);
  return true;
}
