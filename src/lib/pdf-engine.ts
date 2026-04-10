/**
 * pdf-lib wrapper for PDF manipulation (split, merge, rotate, stamp).
 * Used for export operations.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import type { PageId, PdfPage, Segment, SourceFile, StampSettings } from '@/types/pdf';
import {
  formatStampLabel,
  formatFilenameLabel,
  formatMergedFilenameLabel,
  getEffectiveSymbol,
  drawStampOnPage,
  embedJapaneseFont,
  removeMetadata,
} from './pdf-stamper';
import { applyPageRedactions } from './pdf-redactor';

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
  const docCache = new Map<string, PDFDocument>();

  async function getDoc(sourceFileId: string): Promise<PDFDocument> {
    if (docCache.has(sourceFileId)) return docCache.get(sourceFileId)!;
    const sf = sourceFiles[sourceFileId];
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0));
    docCache.set(sourceFileId, doc);
    return doc;
  }

  // 統合対象グループの判定（groupId あり、mergeInExport true、セグメント2個以上）
  const mergeGroupIds = new Set<string>();
  {
    const groupCounts = new Map<string, number>();
    for (const s of segments) {
      if (s.groupId && s.mergeInExport) {
        groupCounts.set(s.groupId, (groupCounts.get(s.groupId) ?? 0) + 1);
      }
    }
    for (const [gid, count] of groupCounts) {
      if (count >= 2) mergeGroupIds.add(gid);
    }
  }
  const processedMergeGroups = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // 統合エクスポート対象グループ
    if (seg.groupId && mergeGroupIds.has(seg.groupId)) {
      if (processedMergeGroups.has(seg.groupId)) {
        onProgress?.(i);
        continue;
      }
      processedMergeGroups.add(seg.groupId);

      const groupSegs = segments.filter(s => s.groupId === seg.groupId);
      const newDoc = await PDFDocument.create();

      for (const gSeg of groupSegs) {
        for (const pageId of gSeg.pageIds) {
          const page = pages[pageId];
          if (!page) continue;
          const srcDoc = await getDoc(page.sourceFileId);
          const [copiedPage] = await newDoc.copyPages(srcDoc, [page.sourcePageIndex]);
          if (page.rotation !== 0) {
            copiedPage.setRotation(degrees(page.rotation));
          }
          newDoc.addPage(copiedPage);

          if (page.redactions.length > 0) {
            const sf = sourceFiles[page.sourceFileId];
            await applyPageRedactions(
              newDoc, newDoc.getPageCount() - 1,
              page.redactions, sf.arrayBuffer, page.sourcePageIndex, null,
            );
          }
        }
      }

      const pdfBytes = await newDoc.save();
      // 先頭セグメントのIDをキーに1つのエントリだけ入れる（他のgroupセグメントIDはMapに含めない）
      result.set(seg.id, pdfBytes);
      onProgress?.(i);
      continue;
    }

    // 通常エクスポート（個別セグメント）
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

      // 墨消し適用
      if (page.redactions.length > 0) {
        const sf = sourceFiles[page.sourceFileId];
        await applyPageRedactions(
          newDoc, newDoc.getPageCount() - 1,
          page.redactions, sf.arrayBuffer, page.sourcePageIndex, null,
        );
      }
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

  // 統合エクスポート対象のグループを特定
  // （groupId があり mergeInExport: true、かつグループ内に2つ以上のセグメントがあるもの）
  const mergeGroupIds = new Set<string>();
  {
    const groupCounts = new Map<string, number>();
    for (const s of segments) {
      if (s.groupId && s.mergeInExport) {
        groupCounts.set(s.groupId, (groupCounts.get(s.groupId) ?? 0) + 1);
      }
    }
    for (const [gid, count] of groupCounts) {
      if (count >= 2) mergeGroupIds.add(gid);
    }
  }
  const processedMergeGroups = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // 統合エクスポート対象グループ
    if (seg.groupId && mergeGroupIds.has(seg.groupId)) {
      if (processedMergeGroups.has(seg.groupId)) {
        onProgress?.(i);
        continue; // 既に先頭セグメントで統合済み
      }
      processedMergeGroups.add(seg.groupId);

      // このグループの全セグメントを収集（入力順を保持）
      const groupSegs = segments.filter(s => s.groupId === seg.groupId);

      try {
        const newDoc = await PDFDocument.create();

        // 各セグメントの「統合PDF内での先頭ページインデックス」を記録しながらページをコピー
        const segFirstPageIndices: number[] = [];
        for (const gSeg of groupSegs) {
          const firstIdxBefore = newDoc.getPageCount();
          let addedAny = false;

          for (const pageId of gSeg.pageIds) {
            const page = pages[pageId];
            if (!page) continue;
            const srcDoc = await getDoc(page.sourceFileId);
            const [copiedPage] = await newDoc.copyPages(srcDoc, [page.sourcePageIndex]);
            if (page.rotation !== 0) {
              copiedPage.setRotation(degrees(page.rotation));
            }
            newDoc.addPage(copiedPage);
            addedAny = true;

            // 墨消し適用
            if (page.redactions.length > 0) {
              const sf = sourceFiles[page.sourceFileId];
              await applyPageRedactions(
                newDoc, newDoc.getPageCount() - 1,
                page.redactions, sf.arrayBuffer, page.sourcePageIndex, fontBytes,
              );
            }
          }

          // このセグメントでページが追加されなかった場合は -1 を入れて後でスキップ
          segFirstPageIndices.push(addedAny ? firstIdxBefore : -1);
        }

        // 各セグメントの先頭ページに個別スタンプ（「甲第1号証の1」「甲第1号証の2」...）
        if (fontBytes) {
          const font = await embedJapaneseFont(newDoc, fontBytes);
          for (let gIdx = 0; gIdx < groupSegs.length; gIdx++) {
            const gSeg = groupSegs[gIdx];
            const firstIdx = segFirstPageIndices[gIdx];
            if (firstIdx < 0 || !gSeg.evidenceNumber) continue;
            const label = formatStampLabel(symbol, gSeg.evidenceNumber, stampSettings.format);
            const segFirstPage = newDoc.getPage(firstIdx);
            drawStampOnPage(segFirstPage, font, label, stampSettings);
          }
        }

        // メタデータ削除
        if (stampSettings.removeMetadata) {
          removeMetadata(newDoc);
        }

        const pdfBytes = await newDoc.save();

        // ファイル名生成（統合ラベル ＋ 先頭セグメントのname）
        const mainNum = seg.evidenceNumber?.main;
        const subNums = groupSegs
          .map(s => s.evidenceNumber?.sub)
          .filter((n): n is number => n != null);
        let filename: string;
        if (mainNum != null && subNums.length >= 2) {
          const subStart = Math.min(...subNums);
          const subEnd = Math.max(...subNums);
          const labelPart = formatMergedFilenameLabel(symbol, mainNum, subStart, subEnd, stampSettings.format);
          filename = `${labelPart} ${seg.name}.pdf`;
        } else {
          filename = `${seg.name}.pdf`;
        }

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

    // 通常エクスポート（個別セグメント）
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

        // 墨消し適用
        if (page.redactions.length > 0) {
          const sf = sourceFiles[page.sourceFileId];
          await applyPageRedactions(
            newDoc, newDoc.getPageCount() - 1,
            page.redactions, sf.arrayBuffer, page.sourcePageIndex, fontBytes,
          );
        }
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
  const docCache = new Map<string, PDFDocument>();
  const symbol = stampSettings ? getEffectiveSymbol(stampSettings) : '';

  async function getDoc(sourceFileId: string): Promise<PDFDocument> {
    if (docCache.has(sourceFileId)) return docCache.get(sourceFileId)!;
    const sf = sourceFiles[sourceFileId];
    const doc = await PDFDocument.load(sf.arrayBuffer.slice(0));
    docCache.set(sourceFileId, doc);
    return doc;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segFirstPageIndex = mergedDoc.getPageCount();

    for (const pageId of seg.pageIds) {
      const page = pages[pageId];
      if (!page) continue;
      const srcDoc = await getDoc(page.sourceFileId);
      const [copiedPage] = await mergedDoc.copyPages(srcDoc, [page.sourcePageIndex]);
      if (page.rotation !== 0) {
        copiedPage.setRotation(degrees(page.rotation));
      }
      mergedDoc.addPage(copiedPage);

      // 墨消し適用
      if (page.redactions.length > 0) {
        const sf = sourceFiles[page.sourceFileId];
        await applyPageRedactions(
          mergedDoc, mergedDoc.getPageCount() - 1,
          page.redactions, sf.arrayBuffer, page.sourcePageIndex, fontBytes,
        );
      }
    }

    // スタンプ描画（各セグメントの先頭ページ）
    if (seg.evidenceNumber && stampSettings && fontBytes) {
      const font = await embedJapaneseFont(mergedDoc, fontBytes);
      const label = formatStampLabel(symbol, seg.evidenceNumber, stampSettings.format);
      const firstPage = mergedDoc.getPage(segFirstPageIndex);
      drawStampOnPage(firstPage, font, label, stampSettings);
    }

    onProgress?.(i);
  }

  // メタデータ削除
  if (stampSettings?.removeMetadata) {
    removeMetadata(mergedDoc);
  }

  return await mergedDoc.save();
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
