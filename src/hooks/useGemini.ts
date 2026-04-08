import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { loadPdfDocument, renderPageToCanvas } from '@/lib/pdf-renderer';
import { analyzeForSplit, canvasToBase64 } from '@/lib/gemini-client';

export function useGemini() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const analyze = useCallback(async () => {
    if (!state.geminiApiKey) {
      const key = prompt('Gemini APIキーを入力してください:');
      if (!key) return;
      dispatch({ type: 'GEMINI_API_KEY_SET', payload: { key } });
    }

    const apiKey = state.geminiApiKey || localStorage.getItem('waketena_gemini_key');
    if (!apiKey) return;

    dispatch({ type: 'AI_PROCESSING_STARTED' });

    try {
      const allPageIds = state.segments.flatMap(s => s.pageIds);
      const pageImages: { pageIndex: number; base64: string; mimeType: string }[] = [];

      for (let i = 0; i < allPageIds.length; i++) {
        const page = state.pages[allPageIds[i]];
        if (!page) continue;

        const sf = state.sourceFiles[page.sourceFileId];
        if (!sf) continue;

        const doc = await loadPdfDocument(sf.arrayBuffer, page.sourceFileId);
        const canvas = document.createElement('canvas');
        await renderPageToCanvas(doc, page.sourcePageIndex, canvas, 0.5, page.rotation);

        const { base64, mimeType } = canvasToBase64(canvas);
        pageImages.push({ pageIndex: i, base64, mimeType });
      }

      const suggestions = await analyzeForSplit(apiKey, pageImages, allPageIds.length);
      dispatch({ type: 'AI_SUGGESTIONS_RECEIVED', payload: { suggestions } });
    } catch (error) {
      console.error('AI analysis failed:', error);
      alert(`AI分析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      dispatch({ type: 'AI_PROCESSING_FINISHED' });
    }
  }, [state.geminiApiKey, state.segments, state.pages, state.sourceFiles, dispatch]);

  return {
    analyze,
    isProcessing: state.isAiProcessing,
    suggestions: state.aiSuggestions,
    applySuggestions: () => dispatch({ type: 'AI_SUGGESTIONS_APPLIED' }),
    dismissSuggestions: () => dispatch({ type: 'AI_SUGGESTIONS_DISMISSED' }),
  };
}
