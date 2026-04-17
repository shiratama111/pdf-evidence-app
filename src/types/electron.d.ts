import type { LibraryEntry, SerializedSession } from './session';

export interface LibraryAPI {
  list: () => Promise<{ success: boolean; sessions: LibraryEntry[]; error?: string }>;
  read: (id: string) => Promise<{ success: boolean; sessionJson?: SerializedSession; binaries?: Record<string, Uint8Array>; error?: string }>;
  save: (
    id: string,
    sessionJson: SerializedSession,
    binaries: Record<string, Uint8Array>,
    thumbnail: Uint8Array | null,
    meta: { name?: string; pageCount?: number; segmentCount?: number } | null,
  ) => Promise<{ success: boolean; error?: string }>;
  delete: (id: string) => Promise<{ success: boolean; error?: string }>;
  rename: (id: string, name: string) => Promise<{ success: boolean; error?: string }>;
  pin: (id: string, pinned: boolean) => Promise<{ success: boolean; error?: string }>;
  thumbnail: (id: string) => Promise<{ success: boolean; dataUrl: string | null; error?: string }>;
}

export interface ArchiveAPI {
  exportDialog: (defaultName?: string) => Promise<string | null>;
  write: (filePath: string, bytes: Uint8Array) => Promise<{ success: boolean; path?: string; error?: string }>;
  openDialog: () => Promise<string | null>;
  read: (filePath: string) => Promise<{ success: boolean; bytes?: Uint8Array; error?: string }>;
}

export interface UpdateInfoPayload {
  version?: string;
  releaseNotes?: string | null;
  releaseDate?: string | null;
}

export interface UpdateProgressPayload {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateErrorPayload {
  message: string;
}

export interface UpdateAPI {
  check: () => Promise<{ success: boolean; updateInfo?: UpdateInfoPayload | null; error?: string }>;
  install: () => Promise<{ success: boolean; error?: string }>;
  onChecking: (cb: (data: Record<string, never>) => void) => () => void;
  onAvailable: (cb: (data: UpdateInfoPayload) => void) => () => void;
  onNotAvailable: (cb: (data: UpdateInfoPayload) => void) => () => void;
  onProgress: (cb: (data: UpdateProgressPayload) => void) => () => void;
  onDownloaded: (cb: (data: UpdateInfoPayload) => void) => () => void;
  onError: (cb: (data: UpdateErrorPayload) => void) => () => void;
}

/** Electron preload で公開される API */
interface ElectronAPI {
  selectOutputDir: () => Promise<string | null>;
  savePdfFile: (dirPath: string, filename: string, bytes: Uint8Array) => Promise<{ success: boolean; path: string; error?: string }>;
  openOutputDir: (dirPath: string) => Promise<void>;
  findJapaneseFont: () => Promise<string | null>;
  readFontFile: (fontPath: string) => Promise<Uint8Array | null>;
  getDefaultOutput: () => Promise<string>;
  library: LibraryAPI;
  archive: ArchiveAPI;
  update: UpdateAPI;
  getVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
