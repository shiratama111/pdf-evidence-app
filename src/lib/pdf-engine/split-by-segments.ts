import { PDFDocument } from 'pdf-lib';
import type { PageId, PdfPage, Segment, SourceFile } from '@/types/pdf';
import {
  appendSegmentPages,
  collectMergedGroupIds,
  createSourceDocGetter,
  type PdfEngineContext,
} from './helpers';

/** セグメントごとにPDFを分割して返す（スタンプなし）
 *  mergeInExport:true のグループは、先頭セグメントのIDをキーに1つの統合PDFとして返す。
 */
export async function splitBySegments(
  sourceFiles: Record<string, SourceFile>,
  pages: Record<PageId, PdfPage>,
  segments: Segment[],
  onProgress?: (segmentIndex: number) => void,
): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  const context: PdfEngineContext = {
    sourceFiles,
    pages,
    getDoc: createSourceDocGetter(sourceFiles),
  };
  const mergeGroupIds = collectMergedGroupIds(segments);
  const processedMergeGroups = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    if (seg.groupId && mergeGroupIds.has(seg.groupId)) {
      if (processedMergeGroups.has(seg.groupId)) {
        onProgress?.(i);
        continue;
      }
      processedMergeGroups.add(seg.groupId);

      const groupSegs = segments.filter(segment => segment.groupId === seg.groupId);
      const newDoc = await PDFDocument.create();

      for (const groupSegment of groupSegs) {
        await appendSegmentPages(newDoc, groupSegment, context, null);
      }

      const pdfBytes = await newDoc.save();
      result.set(seg.id, pdfBytes);
      onProgress?.(i);
      continue;
    }

    const newDoc = await PDFDocument.create();
    await appendSegmentPages(newDoc, seg, context, null);

    const pdfBytes = await newDoc.save();
    result.set(seg.id, pdfBytes);
    onProgress?.(i);
  }

  return result;
}
