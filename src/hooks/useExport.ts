import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { splitBySegments, splitWithStamp } from '@/lib/pdf-engine';
import { downloadPdf, downloadAsZip } from '@/lib/file-utils';

export function useExport() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const exportAll = useCallback(async () => {
    if (state.segments.length === 0) return;

    dispatch({ type: 'EXPORT_STARTED' });

    try {
      const onProgress = (idx: number) => {
        dispatch({
          type: 'EXPORT_PROGRESS',
          payload: { progress: Math.round(((idx + 1) / state.segments.length) * 100) },
        });
      };

      // Electron環境: ファイルシステムに保存
      if (window.electronAPI && state.stampEnabled) {
        // フォント取得
        const fontPath = await window.electronAPI.findJapaneseFont();
        const fontBytes = fontPath ? await window.electronAPI.readFontFile(fontPath) : null;

        // 出力先選択
        let outputDir = await window.electronAPI.getDefaultOutput();
        const selected = await window.electronAPI.selectOutputDir();
        if (selected) outputDir = selected;

        const results = await splitWithStamp(
          state.sourceFiles,
          state.pages,
          state.segments,
          state.stampSettings,
          fontBytes,
          onProgress,
        );

        // ファイル保存
        for (const r of results) {
          if (r.success) {
            await window.electronAPI.savePdfFile(outputDir, r.filename, r.bytes);
          }
        }

        // 出力フォルダを開く
        await window.electronAPI.openOutputDir(outputDir);
      }
      // Electron環境: スタンプなし or ブラウザ環境
      else {
        const result = await splitBySegments(
          state.sourceFiles,
          state.pages,
          state.segments,
          onProgress,
        );

        if (state.exportMode === 'zip') {
          const files = new Map<string, { name: string; bytes: Uint8Array }>();
          for (const seg of state.segments) {
            const bytes = result.get(seg.id);
            if (bytes) files.set(seg.id, { name: seg.name, bytes });
          }
          await downloadAsZip(files);
        } else {
          for (const seg of state.segments) {
            const bytes = result.get(seg.id);
            if (bytes) downloadPdf(bytes, seg.name);
          }
        }
      }
    } finally {
      dispatch({ type: 'EXPORT_FINISHED' });
    }
  }, [state.sourceFiles, state.pages, state.segments, state.stampEnabled, state.stampSettings, state.exportMode, dispatch]);

  return { exportAll, isExporting: state.isExporting, exportProgress: state.exportProgress };
}
