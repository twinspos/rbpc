// RB POS untuk PC (Windows). Membungkus POS (index.html) jadi aplikasi EXE.
// Cetak: USB (printer Windows, byte ESC/POS langsung tanpa dialog), LAN (IP:9100), dan "Cetak Windows" (printer bawaan, tanpa dialog).
const { app, BrowserWindow, ipcMain, protocol, net, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sock = require('net');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');

const WWW = path.join(__dirname, 'www');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null, loads = 0;

function rawPrintExe() {
  return app.isPackaged ? path.join(process.resourcesPath, 'rawprint.exe') : path.join(__dirname, 'rawprint.exe');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'RB POS', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#0d0d0d',
    autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.on('did-navigate', () => { loads++; });
  // link luar (WhatsApp, dll.) dibuka di browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
  // F11 layar penuh, F5 muat ulang, Ctrl+Shift+I alat pengembang
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.key === 'F5') { win.webContents.reload(); e.preventDefault(); }
    else if (i.control && i.shift && (i.key === 'I' || i.key === 'i')) { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
  win.loadURL('app://pos/index.html');
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (!p || p === '/') p = '/index.html';
    const f = path.normalize(path.join(WWW, p));
    if (!f.startsWith(WWW) || !fs.existsSync(f)) return new Response('Tidak ditemukan', { status: 404 });
    return net.fetch(pathToFileURL(f).toString());
  });
  createWindow();
});
app.on('window-all-closed', () => app.quit());

/* ---------- jembatan cetak (dipanggil dari preload.js) ---------- */
const ok = (f) => async (e, a) => { try { return await f(e, a || {}); } catch (err) { return { __err: String((err && err.message) || err) }; } };

ipcMain.handle('usbList', ok(async (e) => {
  const l = await e.sender.getPrintersAsync();
  return { printers: l.map(p => ({ name: p.name, label: p.displayName || p.name, isDefault: !!p.isDefault })) };
}));

ipcMain.handle('usbSend', ok((e, a) => new Promise((res, rej) => {
  if (!a.name) return rej(new Error('printer belum dipilih'));
  const buf = Buffer.from(String(a.data || ''), 'base64');
  if (!buf.length) return rej(new Error('data cetak kosong'));
  const tmp = path.join(os.tmpdir(), 'rbpos-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.bin');
  fs.writeFileSync(tmp, buf);
  execFile(rawPrintExe(), [a.name, tmp], { timeout: 20000, windowsHide: true }, (err, out, se) => {
    fs.unlink(tmp, () => {});
    if (err) return rej(new Error(String(se || '').trim() || err.message));
    res({ ok: true });
  });
})));

ipcMain.handle('tcpSend', ok((e, a) => new Promise((res, rej) => {
  const buf = Buffer.from(String(a.data || ''), 'base64');
  const s = new sock.Socket();
  let done = false;
  const end = (err) => { if (done) return; done = true; try { s.destroy(); } catch (_) {} err ? rej(err) : res({ ok: true }); };
  s.setTimeout(6000, () => end(new Error('printer tidak terjangkau (cek IP dan jaringan)')));
  s.on('error', (err) => end(new Error('printer tidak terjangkau: ' + err.message)));
  s.connect(+a.port || 9100, String(a.ip || ''), () => { s.write(buf, () => s.end()); });
  s.on('close', () => end());
})));

ipcMain.handle('systemPrint', ok((e) => new Promise((res, rej) => {
  e.sender.print({ silent: true, printBackground: true }, (success, why) => success ? res({ ok: true }) : rej(new Error(why || 'gagal mencetak')));
})));

ipcMain.handle('appInfo', ok(() => ({ version: app.getVersion(), build: app.getVersion(), platform: 'windows' })));
ipcMain.handle('openUrl', ok((e, a) => { if (/^https?:/i.test(a.url || '')) shell.openExternal(a.url); return { ok: true }; }));
// sama seperti APK: aplikasi baru dibuka = minta PIN lagi, muat ulang (F5) = tetap login
ipcMain.handle('launchInfo', ok(() => ({ restored: loads > 1 })));
