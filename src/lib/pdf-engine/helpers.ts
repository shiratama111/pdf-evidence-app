import { PDFDocument, degrees, type PDFFont } from 'pdf-lib';
import type {
  EvidenceNumber,
  OutputSettings,
  PageId,
  PdfPage,
  Segment,
  SourceFile,
  StampSettings,
} from '@/types/pdf';
import { applyPageRedactions } from '../pdf-redactor';
import { loadPdfDocument, renderPageToJpegBytes } from '../pdf-renderer';
import {
  drawStampOnPage,
  embedJapaneseFont,
  formatStampLabel,
  getEffectiveSymbol,
  removeMetadata,
} from '../pdf-stamper';
import { normalizePageToA4IfNeeded } from './page-size';

export type SourceDocGetter = (sourceFileId: string) => Promise<PDFDocument>;

export interface PdfEngineContext {
  sourceFiles: Record<string, SourceFile>;
  pages: Record<PageId, PdfPage>;
  getDoc: SourceDocGetter;
}

export interface PdfEngineOptions {
  outputSettings?: OutputSettings;
  onPageSizeProgress?: () => void;
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
    // 権限保護（暗号化）付きPDFでも読み込みを継続する。
    // ただし pdf-lib は復号できないため、暗号化PDFのページは
    // appendSegmentPages 側で copyPages せず pdf.js レンダリングに切り替える
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0), {
      ignoreEncryption: true,
    });
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
  options: PdfEngineOptions = {},
): Promise<SegmentAppendResult> {
  const firstPageIndex = pdfDoc.getPageCount();
  let addedAny = false;

  for (const pageId of segment.pageIds) {
    const page = context.pages[pageId];
    if (!page) continue;

    const srcDoc = await context.getDoc(page.sourceFileId);

    if (srcDoc.isEncrypted) {
      // 暗号化PDFは pdf-lib でストリームを復号できず copyPages すると
      // 白紙・破損ページになるため、pdf.js（透過復号可能）で
      // 高解像度レンダリングして画像ページとして追加する
      const sourceFile = context.sourceFiles[page.sourceFileId];
      const pdfjsDoc = await loadPdfDocument(sourceFile.arrayBuffer, page.sourceFileId);
      const rendered = await renderPageToJpegBytes(pdfjsDoc, page.sourcePageIndex);
      const image = await pdfDoc.embedJpg(rendered.bytes);
      const newPage = pdfDoc.addPage([rendered.width, rendered.height]);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: rendered.width,
        height: rendered.height,
      });
      if (page.rotation !== 0) {
        newPage.setRotation(degrees(page.rotation));
      }
    } else {
      const [copiedPage] = await pdfDoc.copyPages(srcDoc, [page.sourcePageIndex]);
      if (page.rotation !== 0) {
        copiedPage.setRotation(degrees(page.rotation));
      }
      pdfDoc.addPage(copiedPage);
    }
    const addedPageIndex = pdfDoc.getPageCount() - 1;
    addedAny = true;

    if (page.redactions.length > 0) {
      const sourceFile = context.sourceFiles[page.sourceFileId];
      await applyPageRedactions(
        pdfDoc,
        addedPageIndex,
        page.redactions,
        sourceFile.arrayBuffer,
        page.sourcePageIndex,
        fontBytes,
      );
    }

    await normalizePageToA4IfNeeded(
      pdfDoc,
      addedPageIndex,
      options.outputSettings,
    );

    if (options.outputSettings?.pageSizeMode === 'a4') {
      options.onPageSizeProgress?.();
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

  const label = formatStampLabel(
    symbol,
    evidenceNumber,
    stampSettings.format,
    stampSettings.branchFormat,
  );
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
