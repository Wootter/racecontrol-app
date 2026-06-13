const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, shell } = require("electron");
const path = require("path");
const fs   = require("fs");
const { exec } = require('child_process');
const { autoUpdater } = require("electron-updater");

const CONFIG_FILE = path.join(app.getPath("userData"), "config.json");

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch {}
  return { apiUrl: "", alwaysOnTop: true, keybinds: { blue_flag: "F1", next_lap: "F2", pitting: "F3" } };
}
function saveConfig(cfg) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); }

let config     = loadConfig();
let mainWindow = null;
let tray       = null;
let inPits     = false;
let inPits2 = false;
let onCooldown = false;
let onCooldown2 = false;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}
app.on("second-instance", () => {
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
});

const http = require("http");
const OAUTH_PORT = 7823;
let oauthResolve = null;
const oauthServer = http.createServer((req, res) => {
  const url  = new URL(req.url, `http://localhost:${OAUTH_PORT}`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<html><body style='background:#0a0a0f;color:#e8e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;'><h2>✅ Logged in! You can close this window.</h2></body></html>");

  if (oauthResolve) {
    const resolveFn = oauthResolve;
    oauthResolve = null;
    resolveFn(code);
  }
});

oauthServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`[OAuth] Port ${OAUTH_PORT} in use — retrying...`);
    setTimeout(() => {
      oauthServer.close();
      oauthServer.listen(OAUTH_PORT);
    }, 1000);
  } else {
    console.error("[OAuth] Server error:", err.message);
  }
});
oauthServer.listen(OAUTH_PORT);

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();
});


app.on("window-all-closed", () => app.quit());

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("[Updater] Skipping — running in dev mode.");
    return;
  }

  if (config.devPrereleaseOptIn) {
    autoUpdater.allowPrerelease = true;
    console.log("[Updater] Pre-release opt-in enabled.");
  }

  autoUpdater.autoDownload         = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => console.log("[Updater] Checking..."));
  autoUpdater.on("update-not-available", () => console.log("[Updater] Up to date."));
  autoUpdater.on("update-available",  (info) => {
    mainWindow?.webContents.send("update-available",  info.version);
    console.log(`[Updater] Available: v${info.version}`);
  });
  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("update-downloaded", info.version);
    console.log(`[Updater] Downloaded: v${info.version}`);
  });
  autoUpdater.on("error", (err) => {
    console.log("[Updater] Error:", err.message);
    mainWindow?.webContents.send("update-error", err.message);
  });

  setTimeout(() => autoUpdater.checkForUpdates().catch(e => console.log("[Updater]", e.message)), 5000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440, height: 740, minWidth: 380, minHeight: 500,
    alwaysOnTop: config.alwaysOnTop ?? true,
    frame: false, transparent: false, backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      autoplayPolicy: "no-user-gesture-required",
    },
    icon:  path.join(__dirname, "../assets/icon.png"),
    title: "RaceLeague Control",
  });

  mainWindow.loadFile(path.join(__dirname, "renderer.html"));
  if (config.alwaysOnTop) mainWindow.setAlwaysOnTop(true, "screen-saver");

  mainWindow.on("close", () => {
    globalShortcut.unregisterAll();
    app.quit();
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  const iconPath = path.join(__dirname, "../assets/tray.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip("RaceLeague Control");

  const menu = Menu.buildFromTemplate([
    { label: "Show", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: "Always on Top", type: "checkbox", checked: config.alwaysOnTop, click: (item) => {
      config.alwaysOnTop = item.checked;
      mainWindow?.setAlwaysOnTop(item.checked, "screen-saver");
      saveConfig(config);
    }},
    { type: "separator" },
    { label: "Quit", click: () => { globalShortcut.unregisterAll(); app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => { mainWindow?.show(); mainWindow?.focus(); });
}

function registerHotkeys(keybinds) {
  globalShortcut.unregisterAll();
  const { blue_flag, next_lap, pitting, blue_flag2, next_lap2, pitting2 } = keybinds || {};
  if (blue_flag) globalShortcut.register(blue_flag, () => {
    mainWindow?.webContents.send("keybind-fired", "blue_flag");
    sendDriverAction("blue_flag");
  });
  if (next_lap) globalShortcut.register(next_lap, () => {
    mainWindow?.webContents.send("keybind-fired", "next_lap");
    sendDriverAction("next_lap");
  });
  if (pitting) globalShortcut.register(pitting, () => {
    inPits = !inPits;
    mainWindow?.webContents.send("keybind-fired", "pitting");
    sendDriverAction(inPits ? "pitting" : "in_race");
    mainWindow?.webContents.send("pit-state-changed", inPits);
  });
  if (blue_flag2) globalShortcut.register(blue_flag2, () => {
    mainWindow?.webContents.send("keybind-fired", "blue_flag2");
    sendDriverAction2("blue_flag");
  });
  if (next_lap2) globalShortcut.register(next_lap2, () => {
    mainWindow?.webContents.send("keybind-fired", "next_lap2");
    sendDriverAction2("next_lap");
  });
  if (pitting2) globalShortcut.register(pitting2, () => {
    inPits2 = !inPits2;
    mainWindow?.webContents.send("keybind-fired", "pitting2");
    sendDriverAction2(inPits2 ? "pitting" : "in_race");
    mainWindow?.webContents.send("pit-state-changed2", inPits2);
  });
}

async function sendDriverAction(action) {
  if (!config.apiUrl || !config.driver) {
    mainWindow?.webContents.send("toast", { msg: "⚠️ Not configured", type: "err" });
    return;
  }
  if (onCooldown) {
    mainWindow?.webContents.send("toast", { msg: "⏳ Cooldown active", type: "err" });
    return;
  }
  try {
    const stateRes = await fetch(`${config.apiUrl}/driver/state`, {
      headers: { "x-discord-id": config.discordId || "" }
    });
    const stateData = await stateRes.json();
    if (!stateData.raceStarted) {
      mainWindow?.webContents.send("toast", { msg: "⏳ Race not started", type: "err" });
      return;
    }
  } catch {
  }
  try {
    const res = await fetch(`${config.apiUrl}/driver/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  action,
  driver:    config.driver,
  callsign:  config.callsign,
  number:    config.number,
  discordId: config.discordId,
  username:  config.username || config.driver,
  engineer:  config.engineer || false,
}),
    });
    if (res.ok) {
      const labels = { blue_flag:"🔵 Blue Flag", next_lap:"🏁 Next Lap", pitting:"🔧 Pitting", in_race:"🏎️ Back on Track" };
      mainWindow?.webContents.send("toast", { msg: `✓ ${labels[action]}`, type: "ok" });
      onCooldown = true;
      mainWindow?.webContents.send("cooldown-start", 7, 1);
      setTimeout(() => { onCooldown = false; mainWindow?.webContents.send("cooldown-end", 1); }, 7000);
    }
  } catch {
    mainWindow?.webContents.send("toast", { msg: "✗ Bot unreachable", type: "err" });
  }
}

async function sendDriverAction2(action) {
  if (!config.apiUrl || !config.driver2) return;
  if (onCooldown2) {
    mainWindow?.webContents.send("toast", { msg: "⏳ Cooldown active (D2)", type: "err" });
    return;
  }
  try {
    const stateRes = await fetch(`${config.apiUrl}/driver/state`, {
      headers: { "x-discord-id": config.discordId || "" }
    });
    const stateData = await stateRes.json();
    if (!stateData.raceStarted) {
      mainWindow?.webContents.send("toast", { msg: "⏳ Race not started", type: "err" });
      return;
    }
  } catch {}
  try {
    const res = await fetch(`${config.apiUrl}/driver/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        driver:    config.driver2,
        callsign:  config.callsign2,
        number:    config.number2,
        discordId: config.discordId,
        username:  config.username || config.driver2,
        engineer:  config.engineer || false,
      }),
    });
    if (res.ok) {
      const labels = { blue_flag:"🔵 Blue Flag", next_lap:"🏁 Next Lap", pitting:"🔧 Pitting", in_race:"🏎️ Back on Track" };
      mainWindow?.webContents.send("toast", { msg: `✓ ${labels[action]} (D2)`, type: "ok" });
      onCooldown2 = true;
      mainWindow?.webContents.send("cooldown-start", 7, 2);
      setTimeout(() => { onCooldown2 = false; mainWindow?.webContents.send("cooldown-end", 2); }, 7000);
    }
  } catch {
    mainWindow?.webContents.send("toast", { msg: "✗ Bot unreachable", type: "err" });
  }
}

ipcMain.handle("open-oauth", (_, _url) => {
  return new Promise((resolve) => {
    const CLIENT_ID  = "1467595519718195473";
    const REDIRECT   = encodeURIComponent(`http://localhost:${OAUTH_PORT}`);
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT}&response_type=code&scope=identify`;

    const authWin = new BrowserWindow({
      width: 520, height: 720, show: true, alwaysOnTop: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
      title: "Login with Discord", autoHideMenuBar: true,
    });

    oauthResolve = (code) => {
      console.log("[OAuth] Code received:", code ? "yes" : "no");
      oauthResolve = null;
      if (authWin && !authWin.isDestroyed()) {
        setTimeout(() => authWin.destroy(), 1500);
      }
      resolve(code);
    };

    authWin.loadURL(discordUrl);
    authWin.show();
    authWin.focus();

    authWin.on("closed", () => {
      console.log("[OAuth] Window closed");
      if (oauthResolve) {
        oauthResolve = null;
        resolve(null);
      }
    });
  });
});

ipcMain.handle("get-config",     ()      => config);
ipcMain.handle("save-config",    (_, cfg) => { config = { ...config, ...cfg }; saveConfig(config); if (cfg.keybinds) registerHotkeys(cfg.keybinds); return true; });
ipcMain.handle("send-action",    (_, action) => sendDriverAction(action));
ipcMain.handle("toggle-pitting", () => { inPits = !inPits; sendDriverAction(inPits ? "pitting" : "in_race"); mainWindow?.webContents.send("pit-state-changed", inPits); return inPits; });
ipcMain.handle("minimize-app",   () => mainWindow?.minimize());
ipcMain.handle("dev-auth-password", () => {
  let secrets = {};
  try { secrets = require("./secrets.json"); } catch {}
  return process.env.ADMIN_PASSWORD || secrets.adminPassword || null;
});
ipcMain.handle("close-app",      () => { globalShortcut.unregisterAll(); app.quit(); });
ipcMain.handle("toggle-top", () => {
  config.alwaysOnTop = !config.alwaysOnTop;
  mainWindow?.setAlwaysOnTop(config.alwaysOnTop, "screen-saver");
  saveConfig(config);
  return config.alwaysOnTop;
});
ipcMain.handle("open-devtools",  () => mainWindow?.webContents.openDevTools());
ipcMain.handle("install-update", () => autoUpdater.quitAndInstall());
ipcMain.handle("check-version",  () => app.getVersion());
ipcMain.handle("flag-broadcast", (_, data) => mainWindow?.webContents.send("flag-event", data));
ipcMain.handle("register-hotkeys",  (_, keybinds) => { registerHotkeys(keybinds); return true; });
ipcMain.handle("suspend-hotkeys",   () => { globalShortcut.unregisterAll(); return true; });
ipcMain.handle("send-action2",    (_, action) => sendDriverAction2(action));
ipcMain.handle("toggle-pitting2", () => {
  inPits2 = !inPits2;
  sendDriverAction2(inPits2 ? "pitting" : "in_race");
  mainWindow?.webContents.send("pit-state-changed2", inPits2);
  return inPits2;
});
ipcMain.handle("resume-hotkeys",    () => { registerHotkeys(config.keybinds); return true; });
ipcMain.handle("open-releases", () => shell.openExternal("https://github.com/AleEjx/racecontrol-app/releases/latest"));
ipcMain.handle("uninstall", () => {
  const uninstallerPath = path.join(process.env.LOCALAPPDATA, 'RaceLeague Control', 'Update.exe');
  exec(`"${uninstallerPath}" --uninstall`);
  setTimeout(() => { globalShortcut.unregisterAll(); app.quit(); }, 1000);
});

app.on("will-quit", () => globalShortcut.unregisterAll());
