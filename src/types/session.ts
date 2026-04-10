import type {
  AppState,
  PdfPage,
  Segment,
  SourceFile,
  StampSettings,
  ExportMode,
} from './pdf';

export const SESSION_FILE_VERSION = 1 as const;
export const SESSION_FILE_MAGIC = 'pdfevd' as const;

/** SourceFile から arrayBuffer を除いたもの。バイナリは別ファイルとして保存される */
export type SerializedSourceFile = Omit<SourceFile, 'arrayBuffer'>;

/** セッションに保存する状態（UI一時状態は除外） */
export interface SerializedAppState {
  sourceFiles: SerializedSourceFile[];
  pages: PdfPage[];
  segments: Segment[];
  stampSettings: StampSettings;
  stampEnabled: boolean;
  exportMode: ExportMode;
}

/** session.json のフォーマット */
export interface SerializedSession {
  magic: typeof SESSION_FILE_MAGIC;
  version: typeof SESSION_FILE_VERSION;
  savedAt: string; // ISO8601
  app: { name: string; version: string };
  state: SerializedAppState;
}

/** index.json の1エントリ */
export interface LibraryEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fileSizeBytes: number;
  pageCount: number;
  segmentCount: number;
  pinned: boolean;
}

/** index.json のフォーマット */
export interface LibraryIndex {
  version: 1;
  sessions: LibraryEntry[];
}

/** セッション保存ファイルのフォーマットエラー */
export class SessionFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionFormatError';
  }
}

/** 復元時に使う中間表現 */
export interface DecodedSession {
  state: Partial<AppState>;
  sourceFiles: SourceFile[];
}
