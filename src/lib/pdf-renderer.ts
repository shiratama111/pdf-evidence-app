/**
 * pdfjs-dist wrapper for rendering PDF pages to canvas/blob.
 * Used for thumbnail generation and preview display.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker using import.meta.url (Vite recommended)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Cache of loaded PDF documents to avoid re-parsing */
const docCache = new Map<string, pdfjsLib.PDFDocumentProxy>();

export async function loadPdfDocument(
  buffer: ArrayBuffer,
  cacheKey?: string,
): Promise<pdfjsLib.PDFDocumentProxy> {
  if (cacheKey && docCache.has(cacheKey)) {
    return docCache.get(cacheKey)!;
  }
  const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  if (cacheKey) {
    docCache.set(cacheKey, doc);
  }
  return doc;
}

export interface PageInfo {
  width: number;
  height: number;
}

export async function getPageInfo(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
): Promise<PageInfo> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  return { width: viewport.width, height: viewport.height };
}

export async function renderPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
  rotation = 0,
): Promise<void> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

export async function renderPageToBlob(
  doc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  rotation = 0,
): Promise<string> {
  const canvas = document.createElement('canvas');
  await renderPageToCanvas(doc, pageIndex, canvas, scale, rotation);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, 'image/png');
  });
}

export function clearDocCache() {
  for (const doc of docCache.values()) {
    doc.destroy();
  }
  docCache.clear();
}
