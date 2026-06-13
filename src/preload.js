const { contextBridge, ipcRenderer } = require("electron");

function safeOn(channel, cb) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_, ...args) => cb(...args));
}

contextBridge.exposeInMainWorld("api", {
  getConfig:       ()    => ipcRenderer.invoke("get-config"),
  saveConfig:      (cfg) => ipcRenderer.invoke("save-config", cfg),
  sendAction:      (a)   => ipcRenderer.invoke("send-action", a),
  togglePitting:   ()    => ipcRenderer.invoke("toggle-pitting"),
  minimize:        ()    => ipcRenderer.invoke("minimize-app"),
  close:           ()    => ipcRenderer.invoke("close-app"),
  toggleTop:       ()    => ipcRenderer.invoke("toggle-top"),
  openDevTools:    ()    => ipcRenderer.invoke("open-devtools"),
  openOAuth:       (url) => ipcRenderer.invoke("open-oauth", url),
  installUpdate:   ()    => ipcRenderer.invoke("install-update"),
  checkVersion:    ()    => ipcRenderer.invoke("check-version"),
  registerHotkeys: (kb)  => ipcRenderer.invoke("register-hotkeys", kb),
  suspendHotkeys:   ()         => ipcRenderer.invoke("suspend-hotkeys"),
  resumeHotkeys:    ()         => ipcRenderer.invoke("resume-hotkeys"),
  uninstall:       ()    => ipcRenderer.invoke("uninstall"),
  sendAction2:    (action) => ipcRenderer.invoke('send-action2', action),
togglePitting2: ()       => ipcRenderer.invoke('toggle-pitting2'),
  openReleases:    ()    => ipcRenderer.invoke("open-releases"),
  devAuthPassword: () => ipcRenderer.invoke("dev-auth-password"),

  onUpdateAvailable:  (cb) => safeOn("update-available",  cb),
  onUpdateDownloaded: (cb) => safeOn("update-downloaded", cb),
  onUpdateError:      (cb) => safeOn("update-error",      cb),
  onToast:            (cb) => safeOn("toast",             cb),
  onCooldownStart:    (cb) => safeOn("cooldown-start",    cb),
  onCooldownEnd:      (cb) => safeOn("cooldown-end",      cb),
  onPitStateChanged:  (cb) => safeOn("pit-state-changed", cb),
  onFlagEvent:        (cb) => safeOn("flag-event",        cb),
  onKeybindFired:     (cb) => safeOn("keybind-fired",     cb),
});
