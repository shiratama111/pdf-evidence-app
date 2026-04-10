import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { splitBySegments, splitWithStamp, mergeAllSegments } from '@/lib/pdf-engine';
import { downloadPdf, sanitizeFilename } from '@/lib/file-utils';

export type ExportType = 'individual' | 'merged' | 'selected';

export function useExport() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const exportWith = useCallback(async (type: ExportType) => {
    if (state.segments.length === 0) return;

    const isElectron = !!window.electronAPI;

    // 対象セグメントを決定
    let targetSegments = state.segments;
    if (type === 'selected') {
      targetSegments = state.segments.filter(s => state.selectedSegmentIds.includes(s.id));
      if (targetSegments.length === 0) {
        alert('エクスポートするセグメントを選択してください。');
        return;
      }
    }

    // Electron: フォルダ選択
    let outputDir: string | null = null;
    if (isElectron) {
      const selected = await window.electronAPI!.selectOutputDir();
      if (!selected) return; // キャンセル
      outputDir = selected;
    }

    dispatch({ type: 'EXPORT_STARTED' });

    try {
      const onProgress = (idx: number) => {
        dispatch({ type: 'EXPORT_PROGRESS', payload: { progress: Math.round(((idx + 1) / targetSegments.length) * 100) } });
      };

      if (type === 'merged') {
        // ── 統合エクスポート ──
        let fontBytes: Uint8Array | null = null;
        if (state.stampEnabled && isElectron) {
          const fontPath = await window.electronAPI!.findJapaneseFont();
          fontBytes = fontPath ? await window.electronAPI!.readFontFile(fontPath) : null;
          if (!fontPath || !fontBytes) {
            throw new Error('日本語フォントの読み込みに失敗しました。');
          }
        }
        const mergedBytes = await mergeAllSegments(
          state.sourceFiles, state.pages, targetSegments,
          state.stampEnabled ? state.stampSettings : null,
          fontBytes,
          onProgress,
        );
        const filename = '統合ドキュメント.pdf';

        if (isElectron) {
          await window.electronAPI!.savePdfFile(outputDir!, filename, mergedBytes);
          await window.electronAPI!.openOutputDir(outputDir!);
        } else {
          downloadPdf(mergedBytes, '統合ドキュメント');
        }
      } else {
        // ── 個別 or 選択エクスポート ──
        const failures: string[] = [];
        let savedCount = 0;

        if (state.stampEnabled) {
          const fontPath = isElectron ? await window.electronAPI!.findJapaneseFont() : null;
          const fontBytes = fontPath ? await window.electronAPI!.readFontFile(fontPath) : null;
          if (isElectron && (!fontPath || !fontBytes)) {
            throw new Error('日本語フォントの読み込みに失敗しました。');
          }

          const results = await splitWithStamp(
            state.sourceFiles, state.pages, targetSegments,
            state.stampSettings, fontBytes, onProgress,
          );

          for (const r of results) {
            if (!r.success || r.bytes.length === 0) {
              failures.push(`${r.filename}: ${r.error ?? 'PDFの生成結果が空です。'}`);
              continue;
            }
            if (isElectron) {
              const res = await window.electronAPI!.savePdfFile(outputDir!, r.filename, r.bytes);
              if (!res.success) { failures.push(`${r.filename}: ${res.error ?? '保存に失敗しました。'}`); continue; }
            } else {
              downloadPdf(r.bytes, r.filename.replace(/\.pdf$/, ''));
            }
            savedCount++;
          }
        } else {
          const result = await splitBySegments(state.sourceFiles, state.pages, targetSegments, onProgress);
          for (const seg of targetSegments) {
            const bytes = result.get(seg.id);
            if (!bytes) continue;
            const filename = `${sanitizeFilename(seg.name)}.pdf`;
            if (isElectron) {
              const res = await window.electronAPI!.savePdfFile(outputDir!, filename, bytes);
              if (!res.success) { failures.push(`${filename}: ${res.error ?? '保存に失敗しました。'}`); continue; }
            } else {
              downloadPdf(bytes, seg.name);
            }
            savedCount++;
          }
        }

        if (isElectron && savedCount > 0) {
          await window.electronAPI!.openOutputDir(outputDir!);
        }

        if (savedCount === 0) {
          throw new Error(`PDFを保存できませんでした: ${failures[0] ?? '保存対象のPDFがありません。'}`);
        }
        if (failures.length > 0) {
          const details = failures.slice(0, 5).join('\n');
          const overflow = failures.length > 5 ? `\n...他${failures.length - 5}件` : '';
          alert(`一部のPDFを保存できませんでした。\n${details}${overflow}`);
        }
      }
    } catch (err) {
      console.error('[export] error:', err);
      alert(`エクスポートに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      dispatch({ type: 'EXPORT_FINISHED' });
    }
  }, [state.sourceFiles, state.pages, state.segments, state.selectedSegmentIds, state.stampEnabled, state.stampSettings, dispatch]);

  return {
    exportIndividual: () => exportWith('individual'),
    exportMerged: () => exportWith('merged'),
    exportSelected: () => exportWith('selected'),
    isExporting: state.isExporting,
    exportProgress: state.exportProgress,
  };
}
