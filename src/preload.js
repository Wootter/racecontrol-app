const { contextBridge, ipcRenderer } = require("electron");
function safeOn(channel, cb) {
  ipcRenderer.removeAllListeners(channel);
  ipcRenderer.on(channel, (_, ...args) => cb(...args));
}
contextBridge.exposeInMainWorld("api", {
  getConfig:        ()       => ipcRenderer.invoke("get-config"),
  saveConfig:       (cfg)    => ipcRenderer.invoke("save-config", cfg),
  sendAction:       (a)      => ipcRenderer.invoke("send-action", a),
  sendAction2:      (a)      => ipcRenderer.invoke("send-action2", a),
  togglePitting:    ()       => ipcRenderer.invoke("toggle-pitting"),
  togglePitting2:   ()       => ipcRenderer.invoke("toggle-pitting2"),
  minimize:         ()       => ipcRenderer.invoke("minimize-app"),
  close:            ()       => ipcRenderer.invoke("close-app"),
  toggleTop:        ()       => ipcRenderer.invoke("toggle-top"),
  openDevTools:     ()       => ipcRenderer.invoke("open-devtools"),
  openOAuth:        (url)    => ipcRenderer.invoke("open-oauth", url),
  installUpdate:    ()       => ipcRenderer.invoke("install-update"),
  checkVersion:     ()       => ipcRenderer.invoke("check-version"),
  registerHotkeys:  (kb)     => ipcRenderer.invoke("register-hotkeys", kb),
  suspendHotkeys:   ()       => ipcRenderer.invoke("suspend-hotkeys"),
  resumeHotkeys:    ()       => ipcRenderer.invoke("resume-hotkeys"),
  window.api.onPitStateChanged(v  => updatePitBtn(v));
  window.api.onPitStateChanged2(v => updatePitBtn2(v));
  uninstall:        ()       => ipcRenderer.invoke("uninstall"),
  openReleases:     ()       => ipcRenderer.invoke("open-releases"),
  devAuthPassword:  ()       => ipcRenderer.invoke("dev-auth-password"),
  onUpdateAvailable:  (cb) => safeOn("update-available",   cb),
  onUpdateDownloaded: (cb) => safeOn("update-downloaded",  cb),
  onUpdateError:      (cb) => safeOn("update-error",       cb),
  onToast:            (cb) => safeOn("toast",              cb),
  onCooldownStart:    (cb) => safeOn("cooldown-start",     cb),
  onCooldownEnd:      (cb) => safeOn("cooldown-end",       cb),
  onPitStateChanged:  (cb) => safeOn("pit-state-changed",  cb),
  onPitStateChanged2: (cb) => safeOn("pit-state-changed2", cb),
  onFlagEvent:        (cb) => safeOn("flag-event",         cb),
  onKeybindFired:     (cb) => safeOn("keybind-fired",      cb),
});
