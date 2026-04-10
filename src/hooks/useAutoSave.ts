import { useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import { saveLibrarySession } from '@/lib/library-client';
import type { AppState } from '@/types/pdf';

const DEBOUNCE_MS = 5000;

/** ObjectURL or DataURL からPNG Uint8Array を取得 */
async function fetchThumbnailBytes(thumbnailUrl: string | null | undefined): Promise<Uint8Array | undefined> {
  if (!thumbnailUrl) return undefined;
  try {
    const response = await fetch(thumbnailUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}

function findFirstPageThumbnailUrl(state: AppState): string | null {
  const firstSeg = state.segments[0];
  if (!firstSeg) return null;
  const firstPageId = firstSeg.pageIds[0];
  if (!firstPageId) return null;
  return state.pages[firstPageId]?.thumbnailUrl ?? null;
}

/**
 * 5秒debounceの自動保存フック。
 * 編集状態が変わるたびにタイマーをリセットし、5秒経過後に保存を実行する。
 * - currentSessionId が未付与なら crypto.randomUUID() で付与（次のレンダリングで保存）
 * - 連続保存中は inFlightRef で順序を保証
 * - サムネイル: 1ページ目の thumbnailUrl から PNG バイト列を取得
 */
export function useAutoSave() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // 保存対象なし → 何もしない
    if (state.segments.length === 0) return;

    // Electron API がない場合は自動保存無効（vite dev等）
    if (typeof window === 'undefined' || !window.electronAPI?.library) return;

    // currentSessionId 未付与 → 付与のみ実行（次のレンダリングで保存される）
    if (!state.currentSessionId) {
      dispatch({ type: 'SESSION_ID_ASSIGNED', payload: { id: crypto.randomUUID() } });
      return;
    }

    // 5秒debounce
    if (timerRef.current) clearTimeout(timerRef.current);
    const sessionId = state.currentSessionId;
    timerRef.current = setTimeout(async () => {
      // 直前の保存が未完なら待機（順序保証）
      if (inFlightRef.current) {
        try { await inFlightRef.current; } catch { /* ignore */ }
      }
      const promise = (async () => {
        try {
          dispatch({ type: 'SESSION_SAVE_STARTED' });
          const thumbBytes = await fetchThumbnailBytes(findFirstPageThumbnailUrl(state));
          await saveLibrarySession(sessionId, state, thumbBytes ?? null);
          dispatch({ type: 'SESSION_SAVE_FINISHED', payload: { savedAt: new Date().toISOString() } });
        } catch (e) {
          console.error('[autosave] failed', e);
          dispatch({ type: 'SESSION_SAVE_FAILED' });
        }
      })();
      inFlightRef.current = promise;
      try { await promise; } finally { inFlightRef.current = null; }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    state.segments,
    state.pages,
    state.sourceFiles,
    state.stampSettings,
    state.stampEnabled,
    state.exportMode,
    state.currentSessionId,
    dispatch,
    state,
  ]);
}
