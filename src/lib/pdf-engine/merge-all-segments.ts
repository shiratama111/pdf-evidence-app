import { PDFDocument } from 'pdf-lib';
import type { PageId, PdfPage, Segment, SourceFile, StampSettings } from '@/types/pdf';
import {
  appendSegmentPages,
  createSourceDocGetter,
  embedStampFont,
  getStampSymbol,
  removeMetadataIfNeeded,
  stampSegmentFirstPage,
  type PdfEngineContext,
} from './helpers';

/** 全セグメントを1つのPDFに統合して返す */
export async function mergeAllSegments(
  sourceFiles: Record<string, SourceFile>,
  pages: Record<PageId, PdfPage>,
  segments: Segment[],
  stampSettings: StampSettings | null,
  fontBytes: Uint8Array | null,
  onProgress?: (segmentIndex: number) => void,
): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();
  const context: PdfEngineContext = {
    sourceFiles,
    pages,
    getDoc: createSourceDocGetter(sourceFiles),
  };
  const symbol = getStampSymbol(stampSettings);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const appendResult = await appendSegmentPages(mergedDoc, seg, context, fontBytes);

    if (seg.evidenceNumber && stampSettings && fontBytes) {
      const font = await embedStampFont(mergedDoc, fontBytes);
      stampSegmentFirstPage(
        mergedDoc,
        appendResult.firstPageIndex,
        seg.evidenceNumber,
        symbol,
        stampSettings,
        font,
      );
    }

    onProgress?.(i);
  }

  removeMetadataIfNeeded(mergedDoc, stampSettings);
  return await mergedDoc.save();
}
