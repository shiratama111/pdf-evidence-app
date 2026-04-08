/**
 * preload.cjs - Electron IPC ブリッジ
 * contextBridge で electronAPI をレンダラーに公開する。
 */
const { contextBridge, ipcRenderer } = require('electron');

function toTransferablePdfBytes(bytes) {
  if (bytes instanceof Uint8Array) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  if (ArrayBuffer.isView(bytes)) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) {
    return bytes.slice(0);
  }
  return Uint8Array.from(bytes).buffer;
}

contextBridge.exposeInMainWorld('electronAPI', {
  /** 出力先フォルダ選択ダイアログ */
  selectOutputDir: () => ipcRenderer.invoke('select-output-dir'),

  /** PDFバイナリをArrayBuffer化してIPC送信 */
  savePdfFile: (dirPath, filename, bytes) =>
    ipcRenderer.invoke('save-pdf-file', dirPath, filename, toTransferablePdfBytes(bytes)),

  /** 出力フォルダをエクスプローラーで開く */
  openOutputDir: (dirPath) => ipcRenderer.invoke('open-output-dir', dirPath),

  /** 日本語フォントを検出して返す */
  findJapaneseFont: () => ipcRenderer.invoke('find-japanese-font'),

  /** フォントファイルのバイナリを読み込み */
  readFontFile: (fontPath) => ipcRenderer.invoke('read-font-file', fontPath),

  /** デフォルト出力先パスを取得 */
  getDefaultOutput: () => ipcRenderer.invoke('get-default-output'),
});
