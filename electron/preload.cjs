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

function toTransferableBinaries(binaries) {
  // Record<string, Uint8Array> → Record<string, ArrayBuffer>
  const out = {};
  for (const [k, v] of Object.entries(binaries)) {
    out[k] = toTransferablePdfBytes(v);
  }
  return out;
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

  /** ライブラリ管理 API（自動保存先） */
  library: {
    list: () => ipcRenderer.invoke('library:list'),
    read: (id) => ipcRenderer.invoke('library:read', id),
    save: (id, sessionJson, binaries, thumbnail, meta) =>
      ipcRenderer.invoke(
        'library:save',
        id,
        sessionJson,
        toTransferableBinaries(binaries || {}),
        thumbnail ? toTransferablePdfBytes(thumbnail) : null,
        meta || null,
      ),
    delete: (id) => ipcRenderer.invoke('library:delete', id),
    rename: (id, name) => ipcRenderer.invoke('library:rename', id, name),
    pin: (id, pinned) => ipcRenderer.invoke('library:pin', id, pinned),
    thumbnail: (id) => ipcRenderer.invoke('library:thumbnail', id),
  },

  /** アーカイブ書き出し / 読み込み API（.pdfevd ZIP） */
  archive: {
    exportDialog: (defaultName) => ipcRenderer.invoke('archive:export-dialog', defaultName),
    write: (filePath, bytes) => ipcRenderer.invoke('archive:write', filePath, toTransferablePdfBytes(bytes)),
    openDialog: () => ipcRenderer.invoke('archive:open-dialog'),
    read: (filePath) => ipcRenderer.invoke('archive:read', filePath),
  },

  /** 自動アップデート API */
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:checking', fn);
      return () => ipcRenderer.removeListener('update:checking', fn);
    },
    onAvailable: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:available', fn);
      return () => ipcRenderer.removeListener('update:available', fn);
    },
    onNotAvailable: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:not-available', fn);
      return () => ipcRenderer.removeListener('update:not-available', fn);
    },
    onProgress: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:progress', fn);
      return () => ipcRenderer.removeListener('update:progress', fn);
    },
    onDownloaded: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:downloaded', fn);
      return () => ipcRenderer.removeListener('update:downloaded', fn);
    },
    onError: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on('update:error', fn);
      return () => ipcRenderer.removeListener('update:error', fn);
    },
  },

  /** アプリバージョン取得（表示用） */
  getVersion: () => ipcRenderer.invoke('app:version'),
});
