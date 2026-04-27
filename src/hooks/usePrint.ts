import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { mergeAllSegments } from '@/lib/pdf-engine';

export type PrintType = 'all' | 'selected';

/**
 * 印刷フック。エクスポートの mergeAllSegments を流用して
 * スタンプ・墨消し反映済みの 1 PDF を生成し、Electron 経由で
 * OS 印刷ダイアログを開いて印刷する。ブラウザ環境では使用不可。
 */
export function usePrint() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const printWith = useCallback(async (type: PrintType) => {
    if (state.segments.length === 0) return;

    const api = window.electronAPI;
    if (!api?.printPdf) {
      alert('印刷機能はデスクトップアプリでのみ利用できます。');
      return;
    }

    let targetSegments = state.segments;
    if (type === 'selected') {
      targetSegments = state.segments.filter((s) => state.selectedSegmentIds.includes(s.id));
      if (targetSegments.length === 0) {
        alert('印刷するセグメントを選択してください。');
        return;
      }
    }

    dispatch({ type: 'EXPORT_STARTED' });

    try {
      let fontBytes: Uint8Array | null = null;
      if (state.stampEnabled) {
        const fontPath = await api.findJapaneseFont();
        fontBytes = fontPath ? await api.readFontFile(fontPath) : null;
        if (!fontPath || !fontBytes) {
          throw new Error('日本語フォントの読み込みに失敗しました。');
        }
      }

      const onProgress = (idx: number) => {
        dispatch({
          type: 'EXPORT_PROGRESS',
          payload: { progress: Math.round(((idx + 1) / targetSegments.length) * 100) },
        });
      };

      const mergedBytes = await mergeAllSegments(
        state.sourceFiles,
        state.pages,
        targetSegments,
        state.stampEnabled ? state.stampSettings : null,
        fontBytes,
        onProgress,
      );

      const result = await api.printPdf(mergedBytes);
      if (!result.success && result.error && result.error !== 'cancelled') {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('[print] error:', err);
      alert(`印刷に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      dispatch({ type: 'EXPORT_FINISHED' });
    }
  }, [
    state.sourceFiles,
    state.pages,
    state.segments,
    state.selectedSegmentIds,
    state.stampEnabled,
    state.stampSettings,
    dispatch,
  ]);

  return {
    printAll: () => printWith('all'),
    printSelected: () => printWith('selected'),
    isPrinting: state.isExporting,
  };
}
