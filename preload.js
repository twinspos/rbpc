// Jembatan ke POS: meniru plugin APK (window.Capacitor.Plugins.TwinsPrinter) supaya index.html yang sama bisa dipakai.
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, a) => ipcRenderer.invoke(ch, a).then(r => { if (r && r.__err) throw new Error(r.__err); return r; });
const TwinsPrinter = {
  usbList: () => call('usbList'),
  usbSend: (o) => call('usbSend', o),
  tcpSend: (o) => call('tcpSend', o),
  systemPrint: () => call('systemPrint'),
  btList: () => Promise.resolve({ devices: [] }),
  btSend: () => Promise.reject(new Error('Bluetooth tidak tersedia di PC. Pakai USB atau LAN.')),
  openBtSettings: () => Promise.resolve(),
  appInfo: () => call('appInfo'),
  openUrl: (o) => call('openUrl', o),
  launchInfo: () => call('launchInfo')
};
contextBridge.exposeInMainWorld('Capacitor', {
  isNativePlatform: () => true,
  getPlatform: () => 'windows',
  Plugins: { TwinsPrinter }
});
