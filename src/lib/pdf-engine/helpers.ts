import { PDFDocument, degrees, type PDFFont } from 'pdf-lib';
import type {
  EvidenceNumber,
  PageId,
  PdfPage,
  Segment,
  SourceFile,
  StampSettings,
} from '@/types/pdf';
import { applyPageRedactions } from '../pdf-redactor';
import {
  drawStampOnPage,
  embedJapaneseFont,
  formatStampLabel,
  getEffectiveSymbol,
  removeMetadata,
} from '../pdf-stamper';

export type SourceDocGetter = (sourceFileId: string) => Promise<PDFDocument>;

export interface PdfEngineContext {
  sourceFiles: Record<string, SourceFile>;
  pages: Record<PageId, PdfPage>;
  getDoc: SourceDocGetter;
}

export interface SegmentAppendResult {
  firstPageIndex: number;
  addedAny: boolean;
}

export function createSourceDocGetter(
  sourceFiles: Record<string, SourceFile>,
): SourceDocGetter {
  const docCache = new Map<string, PDFDocument>();

  return async (sourceFileId: string) => {
    if (docCache.has(sourceFileId)) return docCache.get(sourceFileId)!;
    const sf = sourceFiles[sourceFileId];
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0));
    docCache.set(sourceFileId, doc);
    return doc;
  };
}

export function collectMergedGroupIds(segments: Segment[]): Set<string> {
  const mergeGroupIds = new Set<string>();
  const groupCounts = new Map<string, number>();

  for (const segment of segments) {
    if (segment.groupId && segment.mergeInExport) {
      groupCounts.set(segment.groupId, (groupCounts.get(segment.groupId) ?? 0) + 1);
    }
  }

  for (const [groupId, count] of groupCounts) {
    if (count >= 2) {
      mergeGroupIds.add(groupId);
    }
  }

  return mergeGroupIds;
}

export async function appendSegmentPages(
  pdfDoc: PDFDocument,
  segment: Segment,
  context: PdfEngineContext,
  fontBytes: Uint8Array | null,
): Promise<SegmentAppendResult> {
  const firstPageIndex = pdfDoc.getPageCount();
  let addedAny = false;

  for (const pageId of segment.pageIds) {
    const page = context.pages[pageId];
    if (!page) continue;

    const srcDoc = await context.getDoc(page.sourceFileId);
    const [copiedPage] = await pdfDoc.copyPages(srcDoc, [page.sourcePageIndex]);
    if (page.rotation !== 0) {
      copiedPage.setRotation(degrees(page.rotation));
    }
    pdfDoc.addPage(copiedPage);
    addedAny = true;

    if (page.redactions.length > 0) {
      const sourceFile = context.sourceFiles[page.sourceFileId];
      await applyPageRedactions(
        pdfDoc,
        pdfDoc.getPageCount() - 1,
        page.redactions,
        sourceFile.arrayBuffer,
        page.sourcePageIndex,
        fontBytes,
      );
    }
  }

  return { firstPageIndex, addedAny };
}

export async function embedStampFont(
  pdfDoc: PDFDocument,
  fontBytes: Uint8Array | null,
): Promise<PDFFont | null> {
  if (!fontBytes) return null;
  return await embedJapaneseFont(pdfDoc, fontBytes);
}

export function getStampSymbol(stampSettings: StampSettings | null): string {
  return stampSettings ? getEffectiveSymbol(stampSettings) : '';
}

export function stampSegmentFirstPage(
  pdfDoc: PDFDocument,
  firstPageIndex: number,
  evidenceNumber: EvidenceNumber | null,
  symbol: string,
  stampSettings: StampSettings,
  font: PDFFont | null,
  pageRotation: number = 0,
): void {
  if (!evidenceNumber || !font) return;

  const label = formatStampLabel(symbol, evidenceNumber, stampSettings.format);
  const firstPage = pdfDoc.getPage(firstPageIndex);
  drawStampOnPage(firstPage, font, label, stampSettings, pageRotation);
}

export function removeMetadataIfNeeded(
  pdfDoc: PDFDocument,
  stampSettings: StampSettings | null,
): void {
  if (stampSettings?.removeMetadata) {
    removeMetadata(pdfDoc);
  }
}
