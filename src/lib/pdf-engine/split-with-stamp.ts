import { PDFDocument } from 'pdf-lib';
import type { PageId, PdfPage, Segment, SourceFile, StampSettings } from '@/types/pdf';
import { formatFilenameLabel, formatMergedFilenameLabel } from '../pdf-stamper';
import {
  appendSegmentPages,
  collectMergedGroupIds,
  createSourceDocGetter,
  embedStampFont,
  getStampSymbol,
  removeMetadataIfNeeded,
  stampSegmentFirstPage,
  type PdfEngineContext,
  type SegmentAppendResult,
} from './helpers';

export interface StampedExportResult {
  segmentId: string;
  filename: string;
  bytes: Uint8Array;
  success: boolean;
  error?: string;
}

function buildMergedFilename(
  segment: Segment,
  groupSegments: Segment[],
  symbol: string,
  stampSettings: StampSettings,
): string {
  const mainNum = segment.evidenceNumber?.main;
  const subNums = groupSegments
    .map(groupSegment => groupSegment.evidenceNumber?.sub)
    .filter((num): num is number => num != null);
  const baseName = segment.groupName ?? segment.name;

  if (mainNum != null && subNums.length >= 2) {
    const subStart = Math.min(...subNums);
    const subEnd = Math.max(...subNums);
    const labelPart = formatMergedFilenameLabel(
      symbol,
      mainNum,
      subStart,
      subEnd,
      stampSettings.format,
    );
    return `${labelPart} ${baseName}.pdf`;
  }

  return `${baseName}.pdf`;
}

function buildSegmentFilename(
  segment: Segment,
  symbol: string,
  stampSettings: StampSettings,
): string {
  if (!segment.evidenceNumber) {
    return `${segment.name}.pdf`;
  }

  const labelPart = formatFilenameLabel(symbol, segment.evidenceNumber, stampSettings.format);
  return `${labelPart} ${segment.name}.pdf`;
}

function stampMergedGroupPages(
  pdfDoc: PDFDocument,
  groupSegments: Segment[],
  appendResults: SegmentAppendResult[],
  symbol: string,
  stampSettings: StampSettings,
  font: Awaited<ReturnType<typeof embedStampFont>>,
): void {
  for (let i = 0; i < groupSegments.length; i++) {
    const groupSegment = groupSegments[i];
    const appendResult = appendResults[i];
    if (!appendResult.addedAny || !groupSegment.evidenceNumber) continue;

    stampSegmentFirstPage(
      pdfDoc,
      appendResult.firstPageIndex,
      groupSegment.evidenceNumber,
      symbol,
      stampSettings,
      font,
    );
  }
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
  const context: PdfEngineContext = {
    sourceFiles,
    pages,
    getDoc: createSourceDocGetter(sourceFiles),
  };
  const symbol = getStampSymbol(stampSettings);
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

      try {
        const newDoc = await PDFDocument.create();
        const appendResults: SegmentAppendResult[] = [];

        for (const groupSegment of groupSegs) {
          appendResults.push(
            await appendSegmentPages(newDoc, groupSegment, context, fontBytes),
          );
        }

        if (fontBytes) {
          const font = await embedStampFont(newDoc, fontBytes);
          stampMergedGroupPages(newDoc, groupSegs, appendResults, symbol, stampSettings, font);
        }

        removeMetadataIfNeeded(newDoc, stampSettings);

        const pdfBytes = await newDoc.save();
        const filename = buildMergedFilename(seg, groupSegs, symbol, stampSettings);
        results.push({ segmentId: seg.id, filename, bytes: pdfBytes, success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[splitWithStamp] merged group export failed:', {
          groupId: seg.groupId,
          segmentCount: groupSegs.length,
          error: errorMessage,
        }, err);
        results.push({
          segmentId: seg.id,
          filename: `${seg.name}.pdf`,
          bytes: new Uint8Array(),
          success: false,
          error: errorMessage,
        });
      }

      onProgress?.(i);
      continue;
    }

    try {
      const newDoc = await PDFDocument.create();
      const appendResult = await appendSegmentPages(newDoc, seg, context, fontBytes);

      if (seg.evidenceNumber && fontBytes) {
        const font = await embedStampFont(newDoc, fontBytes);
        stampSegmentFirstPage(
          newDoc,
          appendResult.firstPageIndex,
          seg.evidenceNumber,
          symbol,
          stampSettings,
          font,
        );
      }

      removeMetadataIfNeeded(newDoc, stampSettings);

      const pdfBytes = await newDoc.save();
      const filename = buildSegmentFilename(seg, symbol, stampSettings);
      results.push({ segmentId: seg.id, filename, bytes: pdfBytes, success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[splitWithStamp] segment export failed:', {
        segmentId: seg.id,
        segmentName: seg.name,
        error: errorMessage,
      }, err);
      results.push({
        segmentId: seg.id,
        filename: `${seg.name}.pdf`,
        bytes: new Uint8Array(),
        success: false,
        error: errorMessage,
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
  const results = await splitWithStamp(
    sourceFiles,
    pages,
    segments,
    stampSettings,
    fontBytes,
    onProgress,
  );
  const map = new Map<string, { name: string; bytes: Uint8Array }>();

  for (const result of results) {
    if (result.success) {
      map.set(result.segmentId, {
        name: result.filename.replace(/\.pdf$/, ''),
        bytes: result.bytes,
      });
    }
  }

  return map;
}
