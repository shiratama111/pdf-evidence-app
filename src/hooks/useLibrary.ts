import { useState, useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppContext';
import * as libClient from '@/lib/library-client';
import { clearDocCache } from '@/lib/pdf-renderer';
import type { LibraryEntry } from '@/types/session';
import { SessionFormatError } from '@/types/session';

export function useLibrary() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [sessions, setSessions] = useState<LibraryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await libClient.listLibrarySessions();
      // 更新日時降順
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSessions(result);
    } catch (e) {
      console.error('[useLibrary] listLibrarySessions failed', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** ライブラリから既存セッションを開く */
  const openSession = useCallback(async (id: string) => {
    try {
      // pdf-renderer のキャッシュをクリア（重要：旧PDFDocumentProxyが残ると壊れる）
      clearDocCache();
      const decoded = await libClient.loadLibrarySession(id);
      dispatch({ type: 'SESSION_RESTORED', payload: { state: decoded.state, sessionId: id } });
    } catch (e) {
      const msg = e instanceof SessionFormatError ? e.message : `セッションの読み込みに失敗しました: ${(e as Error).message}`;
      alert(msg);
    }
  }, [dispatch]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await libClient.deleteLibrarySession(id);
      if (state.currentSessionId === id) {
        // 開いているセッションが削除された場合は新規セッションへ
        clearDocCache();
        dispatch({ type: 'SESSION_NEW_STARTED' });
      }
      await refresh();
    } catch (e) {
      alert(`セッションの削除に失敗しました: ${(e as Error).message}`);
    }
  }, [dispatch, refresh, state.currentSessionId]);

  const renameSession = useCallback(async (id: string, name: string) => {
    try {
      await libClient.renameLibrarySession(id, name);
      await refresh();
    } catch (e) {
      alert(`セッション名の変更に失敗しました: ${(e as Error).message}`);
    }
  }, [refresh]);

  const pinSession = useCallback(async (id: string, pinned: boolean) => {
    try {
      await libClient.pinLibrarySession(id, pinned);
      await refresh();
    } catch (e) {
      alert(`ピン留めの変更に失敗しました: ${(e as Error).message}`);
    }
  }, [refresh]);

  const startNewSession = useCallback(() => {
    clearDocCache();
    dispatch({ type: 'SESSION_NEW_STARTED' });
  }, [dispatch]);

  /** 現在状態をアーカイブとして書き出す */
  const exportArchive = useCallback(async () => {
    if (state.segments.length === 0) {
      alert('書き出す内容がありません');
      return;
    }
    try {
      const defaultName = state.segments[0]?.name || 'session';
      // サムネイル取得（あれば）
      const firstPageId = state.segments[0]?.pageIds[0];
      let thumbBytes: Uint8Array | undefined;
      if (firstPageId && state.pages[firstPageId]?.thumbnailUrl) {
        try {
          const res = await fetch(state.pages[firstPageId].thumbnailUrl!);
          const blob = await res.blob();
          thumbBytes = new Uint8Array(await blob.arrayBuffer());
        } catch { /* ignore */ }
      }
      const savedPath = await libClient.exportArchive(state, defaultName, thumbBytes);
      if (savedPath) {
        alert(`アーカイブを書き出しました:\n${savedPath}`);
      }
    } catch (e) {
      alert(`アーカイブの書き出しに失敗しました: ${(e as Error).message}`);
    }
  }, [state]);

  /** アーカイブを読み込んで新しいセッションとしてライブラリに追加 */
  const importArchive = useCallback(async () => {
    try {
      const decoded = await libClient.importArchive();
      if (!decoded) return;
      const newId = crypto.randomUUID();
      clearDocCache();
      dispatch({ type: 'SESSION_RESTORED', payload: { state: decoded.state, sessionId: newId } });
      // useAutoSave が次の編集or即座に保存してくれる
      await refresh();
    } catch (e) {
      const msg = e instanceof SessionFormatError ? e.message : `アーカイブの読み込みに失敗しました: ${(e as Error).message}`;
      alert(msg);
    }
  }, [dispatch, refresh]);

  return {
    sessions,
    isLoading,
    refresh,
    openSession,
    deleteSession,
    renameSession,
    pinSession,
    startNewSession,
    exportArchive,
    importArchive,
  };
}
