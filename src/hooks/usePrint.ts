import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { mergeAllSegments } from '@/lib/pdf-engine';
import type { Segment } from '@/types/pdf';

export type PrintType = 'all' | 'selected';

function countPages(segments: Segment[]): number {
  return segments.reduce((total, segment) => total + segment.pageIds.length, 0);
}

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

    const isA4Output = state.outputSettings.pageSizeMode === 'a4';
    const totalA4Pages = isA4Output ? countPages(targetSegments) : 0;
    const usePageProgress = isA4Output && totalA4Pages > 0;

    dispatch({
      type: 'PRINT_STARTED',
      payload: {
        message: usePageProgress ? `A4変換中 0/${totalA4Pages}` : '印刷用PDFを生成中...',
      },
    });
    let pdfGenerationFinished = false;

    try {
      let fontBytes: Uint8Array | null = null;
      if (state.stampEnabled) {
        const fontPath = await api.findJapaneseFont();
        fontBytes = fontPath ? await api.readFontFile(fontPath) : null;
        if (!fontPath || !fontBytes) {
          throw new Error('日本語フォントの読み込みに失敗しました。');
        }
      }

      let processedA4Pages = 0;
      const outputOptions = {
        outputSettings: state.outputSettings,
        onPageSizeProgress: usePageProgress
          ? () => {
              processedA4Pages++;
              dispatch({
                type: 'EXPORT_PROGRESS',
                payload: {
                  progress: Math.round((processedA4Pages / totalA4Pages) * 100),
                  message: `A4変換中 ${processedA4Pages}/${totalA4Pages}`,
                },
              });
            }
          : undefined,
      };

      const onProgress = (idx: number) => {
        if (usePageProgress) return;
        dispatch({
          type: 'EXPORT_PROGRESS',
          payload: {
            progress: Math.round(((idx + 1) / targetSegments.length) * 100),
            message: `印刷用PDFを生成中 ${idx + 1}/${targetSegments.length}`,
          },
        });
      };

      const mergedBytes = await mergeAllSegments(
        state.sourceFiles,
        state.pages,
        targetSegments,
        state.stampEnabled ? state.stampSettings : null,
        fontBytes,
        onProgress,
        outputOptions,
      );

      // ローディング表示はPDF生成中だけに限定する。OS印刷ダイアログ側の応答待ちが
      // 戻らない環境でも、アプリ本体を操作不能な状態にしないため。
      pdfGenerationFinished = true;
      dispatch({ type: 'PRINT_FINISHED' });

      const result = await api.printPdf(mergedBytes);
      if (!result.success && result.error && result.error !== 'cancelled') {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('[print] error:', err);
      alert(`印刷に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (!pdfGenerationFinished) {
        dispatch({ type: 'PRINT_FINISHED' });
      }
    }
  }, [
    state.sourceFiles,
    state.pages,
    state.segments,
    state.selectedSegmentIds,
    state.stampEnabled,
    state.stampSettings,
    state.outputSettings,
    dispatch,
  ]);

  return {
    printAll: () => printWith('all'),
    printSelected: () => printWith('selected'),
    isPrinting: state.isPrinting,
  };
}
