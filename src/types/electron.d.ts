/** Electron preload で公開される API */
interface ElectronAPI {
  selectOutputDir: () => Promise<string | null>;
  savePdfFile: (dirPath: string, filename: string, bytes: Uint8Array) => Promise<{ success: boolean; path: string; error?: string }>;
  openOutputDir: (dirPath: string) => Promise<void>;
  findJapaneseFont: () => Promise<string | null>;
  readFontFile: (fontPath: string) => Promise<Uint8Array | null>;
  getDefaultOutput: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
