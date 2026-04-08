const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

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

  // Open DevTools for debugging
  // win.webContents.openDevTools();

  // Remove default menu bar
  win.setMenuBarVisibility(false);

  // Log any load errors
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  win.on('closed', () => {
    console.log('Window closed');
  });
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
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    const outputPath = path.join(dirPath, filename);
    fs.writeFileSync(outputPath, Buffer.from(bytes));
    return { success: true, path: outputPath };
  } catch (err) {
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
