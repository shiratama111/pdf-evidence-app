import JSZip from 'jszip';
import type { AppState, SourceFile } from '@/types/pdf';
import {
  SESSION_FILE_MAGIC,
  SESSION_FILE_VERSION,
  SessionFormatError,
  type SerializedAppState,
  type SerializedSession,
  type SerializedSourceFile,
  type DecodedSession,
} from '@/types/session';

const APP_NAME = 'pdf-evidence-app';
const APP_VERSION = '1.2.0';

/**
 * AppState からシリアライズ用のJSONとバイナリ群を生成する。
 * バイナリは sourceFile.id をキーとした Record で返す。
 */
export function serializeAppState(state: AppState): {
  json: SerializedSession;
  binaries: Record<string, Uint8Array>;
} {
  const sourceFiles: SerializedSourceFile[] = [];
  const binaries: Record<string, Uint8Array> = {};
  for (const sf of Object.values(state.sourceFiles)) {
    const { arrayBuffer: _arrayBuffer, ...rest } = sf;
    sourceFiles.push(rest);
    binaries[sf.id] = new Uint8Array(sf.arrayBuffer);
  }

  // pages の thumbnailUrl は null 化（復元時に再生成される）
  const pages = Object.values(state.pages).map(p => ({
    ...p,
    thumbnailUrl: null,
  }));

  const serializedState: SerializedAppState = {
    sourceFiles,
    pages,
    segments: state.segments,
    stampSettings: state.stampSettings,
    stampEnabled: state.stampEnabled,
    exportMode: state.exportMode,
  };

  const json: SerializedSession = {
    magic: SESSION_FILE_MAGIC,
    version: SESSION_FILE_VERSION,
    savedAt: new Date().toISOString(),
    app: { name: APP_NAME, version: APP_VERSION },
    state: serializedState,
  };

  return { json, binaries };
}

/**
 * シリアライズされた session.json + binaries から AppState 部分を復元する。
 */
export function deserializeAppState(
  json: SerializedSession,
  binaries: Record<string, Uint8Array>,
): DecodedSession {
  const sourceFiles: SourceFile[] = [];
  for (const sf of json.state.sourceFiles) {
    const u8 = binaries[sf.id];
    if (!u8) {
      throw new SessionFormatError(`バイナリが欠損しています: ${sf.name} (${sf.id})`);
    }
    // JSZip の内部バッファ干渉を避けるため、独立した ArrayBuffer を作成
    const independentBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    sourceFiles.push({
      ...sf,
      arrayBuffer: independentBuffer,
    });
  }

  const sourceFilesRecord: Record<string, SourceFile> = {};
  for (const sf of sourceFiles) sourceFilesRecord[sf.id] = sf;

  const pagesRecord: Record<string, typeof json.state.pages[number]> = {};
  for (const p of json.state.pages) {
    pagesRecord[p.id] = { ...p, thumbnailUrl: null };
  }

  const state: Partial<AppState> = {
    sourceFiles: sourceFilesRecord,
    pages: pagesRecord,
    segments: json.state.segments,
    stampSettings: json.state.stampSettings,
    stampEnabled: json.state.stampEnabled,
    exportMode: json.state.exportMode,
  };

  return { state, sourceFiles };
}

/**
 * 任意のオブジェクトが SerializedSession の形をしているか検証する。
 * 不正なら SessionFormatError を投げる。
 */
export function validateSerializedSession(raw: unknown): SerializedSession {
  if (!raw || typeof raw !== 'object') {
    throw new SessionFormatError('セッションファイルの形式が不正です');
  }
  const obj = raw as Record<string, unknown>;
  if (obj.magic !== SESSION_FILE_MAGIC) {
    throw new SessionFormatError('PDF証拠作成アプリのセッションファイルではありません');
  }
  if (obj.version !== SESSION_FILE_VERSION) {
    throw new SessionFormatError(`未対応のバージョンです (v${String(obj.version)})`);
  }
  if (typeof obj.savedAt !== 'string') {
    throw new SessionFormatError('savedAt が不正です');
  }
  if (!obj.state || typeof obj.state !== 'object') {
    throw new SessionFormatError('state フィールドが不正です');
  }
  const state = obj.state as Record<string, unknown>;
  if (!Array.isArray(state.sourceFiles)) {
    throw new SessionFormatError('sourceFiles が不正です');
  }
  if (!Array.isArray(state.pages)) {
    throw new SessionFormatError('pages が不正です');
  }
  if (!Array.isArray(state.segments)) {
    throw new SessionFormatError('segments が不正です');
  }
  return obj as unknown as SerializedSession;
}

/**
 * AppState を .pdfevd ZIPバイト列にエンコードする（エクスポート用）。
 */
export async function encodeArchiveZip(
  state: AppState,
  thumbnailPng?: Uint8Array,
): Promise<Uint8Array> {
  const { json, binaries } = serializeAppState(state);
  const zip = new JSZip();
  zip.file('session.json', JSON.stringify(json, null, 2));
  for (const [id, bytes] of Object.entries(binaries)) {
    zip.file(`binaries/${id}.bin`, bytes);
  }
  if (thumbnailPng) {
    zip.file('thumbnail.png', thumbnailPng);
  }
  // PDF は既に圧縮済みなので STORE で速度優先
  const result = await zip.generateAsync({
    type: 'uint8array',
    compression: 'STORE',
  });
  return result;
}

/**
 * .pdfevd ZIPバイト列を AppState 部分にデコードする（インポート用）。
 */
export async function decodeArchiveZip(bytes: Uint8Array): Promise<DecodedSession & { thumbnail?: Uint8Array }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (e) {
    throw new SessionFormatError(`ZIPファイルの読み込みに失敗しました: ${(e as Error).message}`);
  }

  const sessionFile = zip.file('session.json');
  if (!sessionFile) {
    throw new SessionFormatError('session.json が見つかりません');
  }
  const sessionText = await sessionFile.async('string');
  let parsed: unknown;
  try {
    parsed = JSON.parse(sessionText);
  } catch (e) {
    throw new SessionFormatError(`session.json の JSON パースに失敗しました: ${(e as Error).message}`);
  }
  const json = validateSerializedSession(parsed);

  const binaries: Record<string, Uint8Array> = {};
  for (const sf of json.state.sourceFiles) {
    const binFile = zip.file(`binaries/${sf.id}.bin`);
    if (!binFile) {
      throw new SessionFormatError(`バイナリが欠損しています: ${sf.name}`);
    }
    binaries[sf.id] = await binFile.async('uint8array');
  }

  const decoded = deserializeAppState(json, binaries);

  let thumbnail: Uint8Array | undefined;
  const thumbFile = zip.file('thumbnail.png');
  if (thumbFile) {
    thumbnail = await thumbFile.async('uint8array');
  }

  return { ...decoded, thumbnail };
}
