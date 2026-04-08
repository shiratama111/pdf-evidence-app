/**
 * pdf-lib wrapper for PDF manipulation (split, merge, rotate, stamp).
 * Used for export operations.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import type { PageId, PdfPage, Segment, SourceFile, StampSettings } from '@/types/pdf';
import {
  formatStampLabel,
  formatFilenameLabel,
  getEffectiveSymbol,
  drawStampOnPage,
  embedJapaneseFont,
  removeMetadata,
} from './pdf-stamper';

/** セグメントごとにPDFを分割して返す（スタンプなし） */
export async function splitBySegments(
  sourceFiles: Record<string, SourceFile>,
  pages: Record<PageId, PdfPage>,
  segments: Segment[],
  onProgress?: (segmentIndex: number) => void,
): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  const docCache = new Map<string, PDFDocument>();

  async function getDoc(sourceFileId: string): Promise<PDFDocument> {
    if (docCache.has(sourceFileId)) return docCache.get(sourceFileId)!;
    const sf = sourceFiles[sourceFileId];
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0));
    docCache.set(sourceFileId, doc);
    return doc;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const newDoc = await PDFDocument.create();

    for (const pageId of seg.pageIds) {
      const page = pages[pageId];
      if (!page) continue;
      const srcDoc = await getDoc(page.sourceFileId);
      const [copiedPage] = await newDoc.copyPages(srcDoc, [page.sourcePageIndex]);
      if (page.rotation !== 0) {
        copiedPage.setRotation(degrees(page.rotation));
      }
      newDoc.addPage(copiedPage);
    }

    const pdfBytes = await newDoc.save();
    result.set(seg.id, pdfBytes);
    onProgress?.(i);
  }

  return result;
}

export interface StampedExportResult {
  segmentId: string;
  filename: string;
  bytes: Uint8Array;
  success: boolean;
  error?: string;
}

/** セグメントごとにPDFを分割＋スタンプして返す（Electron用） */
export async function splitWithStamp(
  sourceFiles: Record<string, SourceFile>,
  pages: Record<PageId, PdfPage>,
  segments: Segment[],
  stampSettings: StampSettings,
  fontBytes: Uint8Array | null,
  onProgress?: (segmentIndex: number) => void,
): Promise<StampedExportResult[]> {
  const results: StampedExportResult[] = [];
  const docCache = new Map<string, PDFDocument>();
  const symbol = getEffectiveSymbol(stampSettings);

  async function getDoc(sourceFileId: string): Promise<PDFDocument> {
    if (docCache.has(sourceFileId)) return docCache.get(sourceFileId)!;
    const sf = sourceFiles[sourceFileId];
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0));
    docCache.set(sourceFileId, doc);
    return doc;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    try {
      const newDoc = await PDFDocument.create();

      for (const pageId of seg.pageIds) {
        const page = pages[pageId];
        if (!page) continue;
        const srcDoc = await getDoc(page.sourceFileId);
        const [copiedPage] = await newDoc.copyPages(srcDoc, [page.sourcePageIndex]);
        if (page.rotation !== 0) {
          copiedPage.setRotation(degrees(page.rotation));
        }
        newDoc.addPage(copiedPage);
      }

      // スタンプ描画
      if (seg.evidenceNumber && fontBytes) {
        const font = await embedJapaneseFont(newDoc, fontBytes);
        const label = formatStampLabel(symbol, seg.evidenceNumber, stampSettings.format);
        const firstPage = newDoc.getPage(0);
        drawStampOnPage(firstPage, font, label, stampSettings);
      }

      // メタデータ削除
      if (stampSettings.removeMetadata) {
        removeMetadata(newDoc);
      }

      const pdfBytes = await newDoc.save();

      // ファイル名生成
      let filename: string;
      if (seg.evidenceNumber) {
        const labelPart = formatFilenameLabel(symbol, seg.evidenceNumber, stampSettings.format);
        filename = `${labelPart} ${seg.name}.pdf`;
      } else {
        filename = `${seg.name}.pdf`;
      }

      results.push({ segmentId: seg.id, filename, bytes: pdfBytes, success: true });
    } catch (err) {
      results.push({
        segmentId: seg.id,
        filename: `${seg.name}.pdf`,
        bytes: new Uint8Array(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    onProgress?.(i);
  }

  return results;
}

/** ブラウザ用: セグメントごとにPDFを分割＋スタンプしてダウンロード */
export async function splitWithStampBrowser(
  sourceFiles: Record<string, SourceFile>,
  pages: Record<PageId, PdfPage>,
  segments: Segment[],
  stampSettings: StampSettings,
  fontBytes: Uint8Array | null,
  onProgress?: (segmentIndex: number) => void,
): Promise<Map<string, { name: string; bytes: Uint8Array }>> {
  const results = await splitWithStamp(sourceFiles, pages, segments, stampSettings, fontBytes, onProgress);
  const map = new Map<string, { name: string; bytes: Uint8Array }>();
  for (const r of results) {
    if (r.success) {
      map.set(r.segmentId, { name: r.filename.replace(/\.pdf$/, ''), bytes: r.bytes });
    }
  }
  return map;
}
