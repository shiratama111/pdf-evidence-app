/**
 * preload.cjs - Electron IPC ブリッジ
 * contextBridge で electronAPI をレンダラーに公開する。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** 出力先フォルダ選択ダイアログ */
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),

  /** PDFバイナリをファイルに保存 */
  savePdfFile: (dirPath, filename, bytes) =>
    ipcRenderer.invoke('save-pdf-file', dirPath, filename, bytes),

  /** 出力フォルダをエクスプローラーで開く */
  openOutputDir: (dirPath) => ipcRenderer.invoke('open-output-dir', dirPath),

  /** 日本語フォントを検出して返す */
  findJapaneseFont: () => ipcRenderer.invoke('find-japanese-font'),

  /** フォントファイルのバイナリを読み込み */
  readFontFile: (fontPath) => ipcRenderer.invoke('read-font-file', fontPath),

  /** デフォルト出力先パスを取得 */
  getDefaultOutput: () => ipcRenderer.invoke('get-default-output'),
});
