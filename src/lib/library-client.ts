import type { AppState } from '@/types/pdf';
import type { LibraryEntry, SerializedSession, DecodedSession } from '@/types/session';
import { SessionFormatError } from '@/types/session';
import { serializeAppState, deserializeAppState, encodeArchiveZip, decodeArchiveZip, validateSerializedSession } from './session-codec';

function ensureElectron() {
  if (!window.electronAPI?.library) {
    throw new Error('Electron API が利用できません（ライブラリ機能はElectron版でのみ動作します）');
  }
  return window.electronAPI;
}

/** ライブラリ一覧を取得 */
export async function listLibrarySessions(): Promise<LibraryEntry[]> {
  const api = ensureElectron();
  const result = await api.library.list();
  if (!result.success) throw new Error(result.error || 'ライブラリ一覧の取得に失敗しました');
  return result.sessions;
}

/** セッションをライブラリから読み込み（state + sourceFiles を返す） */
export async function loadLibrarySession(id: string): Promise<DecodedSession> {
  const api = ensureElectron();
  const result = await api.library.read(id);
  if (!result.success || !result.sessionJson || !result.binaries) {
    throw new Error(result.error || 'セッションの読み込みに失敗しました');
  }
  // IPC経由で復元したJSONを念のため検証
  const json = validateSerializedSession(result.sessionJson);
  // binaries の Uint8Array は IPC越しに転送された生バッファ。コピーして安全化
  const binaries: Record<string, Uint8Array> = {};
  for (const [key, value] of Object.entries(result.binaries)) {
    // IPC経由のValueはUint8Arrayまたは類似だが、念のためUint8Arrayでラップ
    binaries[key] = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBufferLike);
  }
  return deserializeAppState(json, binaries);
}

/** AppState をライブラリに保存（IDが既存なら上書き） */
export async function saveLibrarySession(
  id: string,
  state: AppState,
  thumbnailPng: Uint8Array | null,
  customName?: string,
): Promise<void> {
  const api = ensureElectron();
  const { json, binaries } = serializeAppState(state);
  const meta = {
    name: customName || state.segments[0]?.name || '無題',
    pageCount: Object.keys(state.pages).length,
    segmentCount: state.segments.length,
  };
  const result = await api.library.save(id, json as SerializedSession, binaries, thumbnailPng, meta);
  if (!result.success) throw new Error(result.error || 'セッションの保存に失敗しました');
}

/** セッションを削除 */
export async function deleteLibrarySession(id: string): Promise<void> {
  const api = ensureElectron();
  const result = await api.library.delete(id);
  if (!result.success) throw new Error(result.error || 'セッションの削除に失敗しました');
}

/** セッション名を変更 */
export async function renameLibrarySession(id: string, name: string): Promise<void> {
  const api = ensureElectron();
  const result = await api.library.rename(id, name);
  if (!result.success) throw new Error(result.error || 'セッション名の変更に失敗しました');
}

/** ピン留め ON/OFF */
export async function pinLibrarySession(id: string, pinned: boolean): Promise<void> {
  const api = ensureElectron();
  const result = await api.library.pin(id, pinned);
  if (!result.success) throw new Error(result.error || 'ピン留めの更新に失敗しました');
}

/** サムネイル DataURL 取得 */
export async function getLibraryThumbnailDataUrl(id: string): Promise<string | null> {
  const api = ensureElectron();
  const result = await api.library.thumbnail(id);
  if (!result.success) return null;
  return result.dataUrl;
}

// ---------------------------------------------------------------------------
// アーカイブ（.pdfevd ZIP）書き出し / 読み込み
// ---------------------------------------------------------------------------

/** 現在のAppStateをアーカイブとして書き出す（dialogで保存先選択） */
export async function exportArchive(state: AppState, defaultName: string, thumbnailPng?: Uint8Array): Promise<string | null> {
  const api = ensureElectron();
  const filePath = await api.archive.exportDialog(defaultName);
  if (!filePath) return null;
  const zipBytes = await encodeArchiveZip(state, thumbnailPng);
  const result = await api.archive.write(filePath, zipBytes);
  if (!result.success) throw new Error(result.error || 'アーカイブの書き出しに失敗しました');
  return result.path || filePath;
}

/** アーカイブを読み込んでデコード（dialogで選択） */
export async function importArchive(): Promise<(DecodedSession & { thumbnail?: Uint8Array }) | null> {
  const api = ensureElectron();
  const filePath = await api.archive.openDialog();
  if (!filePath) return null;
  const result = await api.archive.read(filePath);
  if (!result.success || !result.bytes) {
    throw new Error(result.error || 'アーカイブの読み込みに失敗しました');
  }
  const u8 = result.bytes instanceof Uint8Array ? result.bytes : new Uint8Array(result.bytes as ArrayBufferLike);
  try {
    return await decodeArchiveZip(u8);
  } catch (e) {
    if (e instanceof SessionFormatError) throw e;
    throw new Error(`アーカイブのデコードに失敗しました: ${(e as Error).message}`);
  }
}
