const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// 自動アップデート設定
// ---------------------------------------------------------------------------
// サイレント自動DL + DL完了時にレンダラーへ通知（Chrome型）
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = {
  info: (...a) => console.log('[updater]', ...a),
  warn: (...a) => console.warn('[updater]', ...a),
  error: (...a) => console.error('[updater]', ...a),
  debug: () => {},
};

function setupAutoUpdater(win) {
  const send = (channel, payload) => {
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch (err) {
      console.warn('[updater] send failed:', channel, err.message);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    send('update:checking', {});
  });
  autoUpdater.on('update-available', (info) => {
    send('update:available', {
      version: info?.version,
      releaseNotes: info?.releaseNotes ?? null,
      releaseDate: info?.releaseDate ?? null,
    });
  });
  autoUpdater.on('update-not-available', (info) => {
    send('update:not-available', { version: info?.version });
  });
  autoUpdater.on('download-progress', (p) => {
    send('update:progress', {
      percent: p?.percent ?? 0,
      transferred: p?.transferred ?? 0,
      total: p?.total ?? 0,
      bytesPerSecond: p?.bytesPerSecond ?? 0,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    send('update:downloaded', {
      version: info?.version,
      releaseNotes: info?.releaseNotes ?? null,
      releaseDate: info?.releaseDate ?? null,
    });
  });
  autoUpdater.on('error', (err) => {
    send('update:error', { message: err?.message || String(err) });
  });
}

function triggerUpdateCheck() {
  if (!app.isPackaged) {
    console.log('[updater] skipped: not packaged (dev mode)');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.warn('[updater] checkForUpdates failed:', err?.message || err);
  });
}

function toNodeBuffer(bytes) {
  if (bytes instanceof Uint8Array) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (ArrayBuffer.isView(bytes)) {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  if (bytes instanceof ArrayBuffer) {
    return Buffer.from(bytes);
  }
  if (Array.isArray(bytes)) {
    return Buffer.from(bytes);
  }
  throw new TypeError(`Unsupported PDF byte payload: ${Object.prototype.toString.call(bytes)}`);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'PDF証拠作成アプリ',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Load the built index.html from dist/
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  console.log('Loading:', indexPath, 'exists:', fs.existsSync(indexPath));
  win.loadFile(indexPath);

  // Open DevTools only in development (not when packaged)
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

  // Remove default menu bar
  win.setMenuBarVisibility(false);

  // Log any load errors
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Catch renderer crashes
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer crashed:', details);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  win.on('closed', () => {
    console.log('Window closed');
  });

  // Prevent window from closing on errors
  win.on('unresponsive', () => {
    console.error('Window became unresponsive');
  });

  // 自動アップデート: イベント配線 + 初回チェックを少し遅延して実行
  setupAutoUpdater(win);
  setTimeout(triggerUpdateCheck, 3000);
}

// ---------------------------------------------------------------------------
// IPC ハンドラ
// ---------------------------------------------------------------------------

/** 出力先フォルダ選択ダイアログ */
ipcMain.handle('select-output-dir', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: '出力先フォルダを選択',
  });
  return result.canceled ? null : result.filePaths[0];
});

/** PDFバイナリをファイルに保存 */
ipcMain.handle('save-pdf-file', async (_event, dirPath, filename, bytes) => {
  const byteLength = typeof bytes?.byteLength === 'number' ? bytes.byteLength : bytes?.length;
  console.log('[save-pdf-file] dirPath:', dirPath, 'filename:', filename, 'bytes type:', typeof bytes, 'length:', byteLength);
  try {
    fs.mkdirSync(dirPath, { recursive: true });

    // 同名ファイルが存在する場合、(1), (2)... を付与
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    let outputPath = path.join(dirPath, filename);
    let counter = 1;
    while (fs.existsSync(outputPath)) {
      outputPath = path.join(dirPath, `${base}(${counter})${ext}`);
      counter++;
    }

    const buffer = toNodeBuffer(bytes);
    console.log('[save-pdf-file] writing', buffer.length, 'bytes to', outputPath);
    fs.writeFileSync(outputPath, buffer);
    console.log('[save-pdf-file] success:', outputPath);
    return { success: true, path: outputPath };
  } catch (err) {
    console.error('[save-pdf-file] error:', err.message);
    return { success: false, path: '', error: err.message };
  }
});

/** エクスプローラーで出力フォルダを開く */
ipcMain.handle('open-output-dir', async (_event, dirPath) => {
  shell.openPath(dirPath);
});

/** 日本語フォント検出 */
ipcMain.handle('find-japanese-font', async () => {
  const platform = process.platform;
  let candidates = [];

  if (platform === 'win32') {
    const d = 'C:\\Windows\\Fonts';
    candidates = [
      path.join(d, 'YuGothB.ttc'),          // Yu Gothic Bold
      path.join(d, 'BIZ-UDGothicB.ttc'),    // BIZ UD Gothic Bold
      path.join(d, 'meiryob.ttc'),           // Meiryo Bold
      path.join(d, 'msgothic.ttc'),          // MS Gothic (fallback)
    ];
  } else if (platform === 'darwin') {
    candidates = [
      '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
      '/System/Library/Fonts/Supplemental/Osaka.ttf',
      '/Library/Fonts/Arial Unicode.ttf',
    ];
  } else {
    candidates = [
      '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    ];
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
});

/** フォントファイルのバイナリ読み込み */
ipcMain.handle('read-font-file', async (_event, fontPath) => {
  try {
    const buf = fs.readFileSync(fontPath);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
});

/** デフォルト出力先パス */
ipcMain.handle('get-default-output', async () => {
  const desktop = app.getPath('desktop');
  return path.join(desktop, '証拠スタンプ出力');
});

/**
 * PDFバイナリを OS 印刷ダイアログ経由で印刷する。
 * 一時ファイルに書き出してから非表示の BrowserWindow に loadFile し、
 * Electron 内蔵の Chrome PDF Viewer 上で webContents.print() を呼ぶ。
 *
 * 注意: Windows 印刷ダイアログで「プレビュー」を選ぶと「印刷プレビューに対応していない」
 * 旨のメッセージが出ることがあるが、そのまま OK すれば印刷自体は進む（プレビュー UI を
 * Electron が提供していないだけで、印刷ジョブは正常）。
 */
ipcMain.handle('print:pdf', async (_event, bytes) => {
  let tmpPath = null;
  let printWin = null;
  try {
    const byteLength = typeof bytes?.byteLength === 'number' ? bytes.byteLength : bytes?.length;
    console.log('[print:pdf] received bytes:', byteLength);

    const tmpDir = app.getPath('temp');
    tmpPath = path.join(tmpDir, `pdf-evidence-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);
    fs.writeFileSync(tmpPath, toNodeBuffer(bytes));
    const stat = fs.statSync(tmpPath);
    console.log('[print:pdf] wrote', stat.size, 'bytes to', tmpPath);

    printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        plugins: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    await printWin.loadFile(tmpPath);
    // Chrome PDF Viewer が初期化される時間を確保
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = await new Promise((resolve) => {
      printWin.webContents.print(
        { silent: false, printBackground: true, color: true },
        (success, errorType) => {
          resolve({ success, errorType: errorType || null });
        },
      );
    });

    return { success: result.success, error: result.success ? undefined : (result.errorType || 'cancelled') };
  } catch (err) {
    console.error('[print:pdf] error:', err.message, err.stack);
    return { success: false, error: err.message };
  } finally {
    try { if (printWin && !printWin.isDestroyed()) printWin.close(); } catch {}
    if (tmpPath) {
      // 印刷ジョブが OS に渡るまで少し残してから削除
      setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch {} }, 30000);
    }
  }
});

// ---------------------------------------------------------------------------
// ライブラリ管理（自動保存先）
// ---------------------------------------------------------------------------

const LIBRARY_DIR = path.join(app.getPath('userData'), 'library');
const SESSIONS_DIR = path.join(LIBRARY_DIR, 'sessions');
const INDEX_PATH = path.join(LIBRARY_DIR, 'index.json');
const MAX_LIBRARY_ENTRIES = 30;

function ensureLibraryDirs() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ version: 1, sessions: [] }, null, 2));
  }
}

function readLibraryIndex() {
  try {
    ensureLibraryDirs();
    const text = fs.readFileSync(INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions)) {
      throw new Error('invalid index format');
    }
    return parsed;
  } catch (err) {
    console.warn('[library] index.json broken, rebuilding:', err.message);
    return rebuildLibraryIndex();
  }
}

function writeLibraryIndex(index) {
  ensureLibraryDirs();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

/** sessions ディレクトリを walk して index.json を再構築 */
function rebuildLibraryIndex() {
  ensureLibraryDirs();
  const sessions = [];
  try {
    const dirs = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
    for (const dirent of dirs) {
      if (!dirent.isDirectory()) continue;
      const sessionDir = path.join(SESSIONS_DIR, dirent.name);
      const sessionJsonPath = path.join(sessionDir, 'session.json');
      if (!fs.existsSync(sessionJsonPath)) continue;
      try {
        const json = JSON.parse(fs.readFileSync(sessionJsonPath, 'utf-8'));
        const stat = fs.statSync(sessionJsonPath);
        const binariesDir = path.join(sessionDir, 'binaries');
        let fileSizeBytes = 0;
        if (fs.existsSync(binariesDir)) {
          for (const f of fs.readdirSync(binariesDir)) {
            fileSizeBytes += fs.statSync(path.join(binariesDir, f)).size;
          }
        }
        sessions.push({
          id: dirent.name,
          name: json.state?.sourceFiles?.[0]?.name || '無題',
          createdAt: json.savedAt || stat.birthtime.toISOString(),
          updatedAt: json.savedAt || stat.mtime.toISOString(),
          fileSizeBytes,
          pageCount: Array.isArray(json.state?.pages) ? json.state.pages.length : 0,
          segmentCount: Array.isArray(json.state?.segments) ? json.state.segments.length : 0,
          pinned: false,
        });
      } catch (e) {
        console.warn(`[library] failed to parse session ${dirent.name}:`, e.message);
      }
    }
  } catch (e) {
    console.warn('[library] failed to walk sessions dir:', e.message);
  }
  const index = { version: 1, sessions };
  writeLibraryIndex(index);
  return index;
}

/** 30件超過時、古い順（pinned除外）に削除 */
function enforceLibraryLimit(index) {
  const unpinned = index.sessions.filter(s => !s.pinned);
  const overflow = unpinned.length - MAX_LIBRARY_ENTRIES;
  if (overflow <= 0) return index;

  const sorted = [...unpinned].sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  const toDelete = sorted.slice(0, overflow);
  const deleteIds = new Set(toDelete.map(s => s.id));

  for (const id of deleteIds) {
    const dir = path.join(SESSIONS_DIR, id);
    try {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[library] failed to delete overflow session ${id}:`, e.message);
    }
  }
  index.sessions = index.sessions.filter(s => !deleteIds.has(s.id));
  return index;
}

/** ライブラリ一覧取得 */
ipcMain.handle('library:list', async () => {
  try {
    const index = readLibraryIndex();
    return { success: true, sessions: index.sessions };
  } catch (err) {
    console.error('[library:list] error:', err.message);
    return { success: false, sessions: [], error: err.message };
  }
});

/** セッション読込（session.json + binaries 全取得） */
ipcMain.handle('library:read', async (_event, id) => {
  try {
    const sessionDir = path.join(SESSIONS_DIR, id);
    const sessionJsonPath = path.join(sessionDir, 'session.json');
    if (!fs.existsSync(sessionJsonPath)) {
      return { success: false, error: 'session.json not found' };
    }
    const sessionText = fs.readFileSync(sessionJsonPath, 'utf-8');
    const sessionJson = JSON.parse(sessionText);
    const binaries = {};
    const binariesDir = path.join(sessionDir, 'binaries');
    if (fs.existsSync(binariesDir)) {
      for (const f of fs.readdirSync(binariesDir)) {
        const id = path.basename(f, '.bin');
        const buf = fs.readFileSync(path.join(binariesDir, f));
        binaries[id] = new Uint8Array(buf);
      }
    }
    return { success: true, sessionJson, binaries };
  } catch (err) {
    console.error('[library:read] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** セッション保存（session.json + binaries + thumbnail + index更新 + 30件管理） */
ipcMain.handle('library:save', async (_event, id, sessionJson, binaries, thumbnailPng, meta) => {
  try {
    ensureLibraryDirs();
    const sessionDir = path.join(SESSIONS_DIR, id);
    const binariesDir = path.join(sessionDir, 'binaries');
    fs.mkdirSync(binariesDir, { recursive: true });

    fs.writeFileSync(path.join(sessionDir, 'session.json'), JSON.stringify(sessionJson, null, 2));

    let totalBinaryBytes = 0;
    if (binaries && typeof binaries === 'object') {
      // 古いbinariesは一旦消す（リネーム/差し替え対応）
      for (const f of fs.readdirSync(binariesDir)) {
        try { fs.unlinkSync(path.join(binariesDir, f)); } catch {}
      }
      for (const [fileId, bytes] of Object.entries(binaries)) {
        const buf = toNodeBuffer(bytes);
        fs.writeFileSync(path.join(binariesDir, `${fileId}.bin`), buf);
        totalBinaryBytes += buf.length;
      }
    }

    // サムネイル: 渡されていれば書き込む（既存があれば上書き）
    const thumbPath = path.join(sessionDir, 'thumbnail.png');
    if (thumbnailPng) {
      const buf = toNodeBuffer(thumbnailPng);
      fs.writeFileSync(thumbPath, buf);
    }

    // index 更新
    let index = readLibraryIndex();
    const now = new Date().toISOString();
    const existing = index.sessions.find(s => s.id === id);
    const entry = {
      id,
      name: meta?.name || existing?.name || sessionJson?.state?.sourceFiles?.[0]?.name || '無題',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      fileSizeBytes: totalBinaryBytes,
      pageCount: meta?.pageCount ?? (Array.isArray(sessionJson?.state?.pages) ? sessionJson.state.pages.length : 0),
      segmentCount: meta?.segmentCount ?? (Array.isArray(sessionJson?.state?.segments) ? sessionJson.state.segments.length : 0),
      pinned: existing?.pinned || false,
    };
    if (existing) {
      index.sessions = index.sessions.map(s => s.id === id ? entry : s);
    } else {
      index.sessions.push(entry);
    }

    // 30件管理
    index = enforceLibraryLimit(index);
    writeLibraryIndex(index);

    return { success: true };
  } catch (err) {
    console.error('[library:save] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** セッション削除 */
ipcMain.handle('library:delete', async (_event, id) => {
  try {
    const sessionDir = path.join(SESSIONS_DIR, id);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    const index = readLibraryIndex();
    index.sessions = index.sessions.filter(s => s.id !== id);
    writeLibraryIndex(index);
    return { success: true };
  } catch (err) {
    console.error('[library:delete] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** セッション名変更 */
ipcMain.handle('library:rename', async (_event, id, name) => {
  try {
    const index = readLibraryIndex();
    index.sessions = index.sessions.map(s => s.id === id ? { ...s, name } : s);
    writeLibraryIndex(index);
    return { success: true };
  } catch (err) {
    console.error('[library:rename] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** ピン留めON/OFF */
ipcMain.handle('library:pin', async (_event, id, pinned) => {
  try {
    const index = readLibraryIndex();
    index.sessions = index.sessions.map(s => s.id === id ? { ...s, pinned: !!pinned } : s);
    writeLibraryIndex(index);
    return { success: true };
  } catch (err) {
    console.error('[library:pin] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** サムネイル PNG バイナリを base64 DataURL で返す */
ipcMain.handle('library:thumbnail', async (_event, id) => {
  try {
    const thumbPath = path.join(SESSIONS_DIR, id, 'thumbnail.png');
    if (!fs.existsSync(thumbPath)) return { success: true, dataUrl: null };
    const buf = fs.readFileSync(thumbPath);
    const base64 = buf.toString('base64');
    return { success: true, dataUrl: `data:image/png;base64,${base64}` };
  } catch (err) {
    return { success: false, dataUrl: null, error: err.message };
  }
});

// ---------------------------------------------------------------------------
// アーカイブ書き出し / 読み込み（.pdfevd ZIP）
// ---------------------------------------------------------------------------

/** アーカイブ書き出し先選択 */
ipcMain.handle('archive:export-dialog', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: 'アーカイブを書き出す',
    defaultPath: defaultName ? `${defaultName}.pdfevd` : 'session.pdfevd',
    filters: [{ name: 'PDF Evidence Archive', extensions: ['pdfevd'] }],
  });
  return result.canceled ? null : result.filePath;
});

/** アーカイブ書き出し（任意パスにZIP書込） */
ipcMain.handle('archive:write', async (_event, filePath, bytes) => {
  try {
    const buf = toNodeBuffer(bytes);
    fs.writeFileSync(filePath, buf);
    return { success: true, path: filePath };
  } catch (err) {
    console.error('[archive:write] error:', err.message);
    return { success: false, error: err.message };
  }
});

/** アーカイブ読み込み元選択 */
ipcMain.handle('archive:open-dialog', async () => {
  const result = await dialog.showOpenDialog({
    title: 'アーカイブを読み込む',
    properties: ['openFile'],
    filters: [{ name: 'PDF Evidence Archive', extensions: ['pdfevd'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

/** アーカイブ読み込み（任意パスからZIPバイト返却） */
ipcMain.handle('archive:read', async (_event, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    return { success: true, bytes: new Uint8Array(buf) };
  } catch (err) {
    console.error('[archive:read] error:', err.message);
    return { success: false, error: err.message };
  }
});

// ---------------------------------------------------------------------------
// 自動アップデート IPC
// ---------------------------------------------------------------------------

/** 手動での更新チェック（ヘッダーボタン等から） */
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    return { success: false, error: 'dev mode: skipped' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      success: true,
      updateInfo: result?.updateInfo
        ? {
            version: result.updateInfo.version,
            releaseNotes: result.updateInfo.releaseNotes ?? null,
            releaseDate: result.updateInfo.releaseDate ?? null,
          }
        : null,
    };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

/** DL完了後、再起動してインストール適用 */
ipcMain.handle('update:install', async () => {
  try {
    // 第1引数: isSilent (NSISのサイレントインストール)
    //   → true: アップデート時にインストーラUI・ダイアログを一切出さない
    //   → build/installer.nsh の IfSilent で MessageBox もスキップされる
    // 第2引数: isForceRunAfter (インストール後に自動起動)
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
});

/** 現在のアプリバージョン取得（UI表示用） */
ipcMain.handle('app:version', async () => {
  return app.getVersion();
});

// ---------------------------------------------------------------------------
// アプリケーションライフサイクル
// ---------------------------------------------------------------------------

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
