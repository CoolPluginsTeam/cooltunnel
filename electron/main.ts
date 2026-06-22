import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from "electron";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDiagnosticBundle } from "./services/diagnosticService";
import { migrateLegacyUserData } from "./services/dataMigrationService";
import { LogService } from "./services/logService";
import { createProfileExport, ProfileService } from "./services/profileService";
import { SettingsService } from "./services/settingsService";
import { TunnelService } from "./services/tunnelService";
import { UpdateService } from "./services/updateService";
import { WordPressService } from "./services/wordpressService";
import { parseLocalUrl } from "../shared/tunnel";
import { BRAND, getBrandInfo } from "../shared/brand";
import type {
  AppSettings,
  DiagnosticOptions,
  ProfileConflictStrategy,
  SiteProfile,
  StopTunnelOptions,
  TunnelStartOptions
} from "../shared/types";

const logs = new LogService();
const settings = new SettingsService();
const tunnel = new TunnelService(logs);
const wordpress = new WordPressService();
let profiles: ProfileService;
let updates: UpdateService;
let mainWindow: BrowserWindow | null = null;
let quitting = false;
let startupErrorShowing = false;
const appIcon = () => app.isPackaged
  ? path.join(process.resourcesPath, "icon.png")
  : path.join(app.getAppPath(), "build", "icon.png");

app.setName(BRAND.productName);
app.setPath("userData", path.join(app.getPath("appData"), BRAND.productName));
app.setAppUserModelId(BRAND.appId);
Menu.setApplicationMenu(null);
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

function showStartupError(error: unknown): void {
  if (startupErrorShowing) return;
  startupErrorShowing = true;
  const message = error instanceof Error ? `${error.message}\n\n${error.stack ?? ""}` : String(error);
  const logPath = path.join(app.getPath("userData"), "startup-error.log");
  void fs.writeFile(logPath, `${new Date().toISOString()}\n${message}\n`, "utf8");
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = new BrowserWindow({
      width: 720,
      height: 460,
      backgroundColor: "#ffffff",
      icon: appIcon(),
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
  }
  const safeMessage = message.replace(/[&<>"']/g, (value) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  }[value]!));
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!doctype html><html><body style="font-family:Segoe UI,sans-serif;padding:32px;color:#172033">
    <h1>${BRAND.productName} could not start</h1>
    <p>Please share this log with support:</p>
    <code>${logPath}</code>
    <pre style="white-space:pre-wrap;background:#f4f6f8;padding:16px;border-radius:10px;margin-top:20px">${safeMessage}</pre>
    </body></html>
  `)}`);
  mainWindow.show();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 960,
    minHeight: 650,
    backgroundColor: "#f5f7fb",
    icon: appIcon(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 5000);
  mainWindow.once("closed", () => clearTimeout(showFallback));
  mainWindow.webContents.on("did-fail-load", (_event, code, description) => {
    showStartupError(new Error(`Renderer failed to load (${code}): ${description}`));
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if ((!devUrl || !url.startsWith(devUrl)) && !url.startsWith("file:") && !url.startsWith("data:text/html")) {
      event.preventDefault();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle("tunnel:parse-url", (_event, url: string) => parseLocalUrl(url));
  ipcMain.handle("tunnel:get-state", () => tunnel.getState());
  ipcMain.handle("tunnel:start", async (_event, options: TunnelStartOptions) => {
    try {
      return await tunnel.start(options, await settings.get());
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "Could not start tunnel.");
    }
  });
  ipcMain.handle("tunnel:stop", async (_event, options?: StopTunnelOptions) => {
    if (options?.removeSessionFixes) {
      const results = await wordpress.removeSessionFixes();
      for (const result of results) logs.add("info", `${result.message}: ${path.basename(result.path)}`);
    }
    return tunnel.stop();
  });

  ipcMain.handle("wordpress:scan", async (_event, host?: string) => {
    const current = await settings.get();
    return wordpress.scan(current.scanFolders, host);
  });
  ipcMain.handle("wordpress:choose-folder", async () => {
    const options: Electron.OpenDialogOptions = {
      title: "Choose a WordPress folder",
      properties: ["openDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    const folder = result.filePaths[0];
    const site = await wordpress.resolveWordPressRoot(folder);
    if (!site) throw new Error("That folder is not a valid WordPress or LocalWP installation.");
    return site;
  });
  ipcMain.handle("wordpress:validate", (_event, folder: string) => wordpress.isValid(folder));
  ipcMain.handle("wordpress:apply", async (
    _event,
    folder: string,
    fixHtaccess: boolean,
    pathname?: string,
    localUrl?: string
  ) => {
    const results = await wordpress.apply(folder, fixHtaccess, pathname, localUrl);
    for (const result of results) logs.add("success", `${result.message}: ${path.basename(result.path)}`);
    return results;
  });
  ipcMain.handle("wordpress:remove", async (_event, folder: string, removeHtaccess: boolean) => {
    const results = await wordpress.remove(folder, removeHtaccess);
    for (const result of results) logs.add("info", `${result.message}: ${path.basename(result.path)}`);
    return results;
  });
  ipcMain.handle("wordpress:check-compatibility", (_event, publicUrl: string, localUrl: string) =>
    wordpress.checkCompatibility(publicUrl, localUrl));

  ipcMain.handle("settings:get", () => settings.get());
  ipcMain.handle("settings:update", (_event, patch: Partial<AppSettings>) => settings.update(patch));
  ipcMain.handle("settings:reset", () => settings.reset());

  ipcMain.handle("profiles:list", () => profiles.list());
  ipcMain.handle("profiles:create", (_event, profile: Omit<SiteProfile, "id" | "createdAt" | "updatedAt">) =>
    profiles.create(profile));
  ipcMain.handle("profiles:update", (_event, id: string, patch: Partial<SiteProfile>) => profiles.update(id, patch));
  ipcMain.handle("profiles:remove", (_event, id: string) => profiles.remove(id));
  ipcMain.handle("profiles:duplicate", (_event, id: string) => profiles.duplicate(id));
  ipcMain.handle("profiles:export", async (_event, includePaths: boolean) => {
    const options: Electron.SaveDialogOptions = {
      title: `Export ${BRAND.productName} profiles`,
      defaultPath: `cooltunnel-profiles-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    };
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, JSON.stringify(createProfileExport(await profiles.list(), includePaths), null, 2), "utf8");
    return result.filePath;
  });
  ipcMain.handle("profiles:preview-import", async () => {
    const options: Electron.OpenDialogOptions = {
      title: `Import ${BRAND.productName} profiles`,
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }]
    };
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    return profiles.previewImport(result.filePaths[0]);
  });
  ipcMain.handle("profiles:commit-import", (_event, filePath: string, strategy: ProfileConflictStrategy) =>
    profiles.commitImport(filePath, strategy));

  ipcMain.handle("updates:get-state", () => updates.getState());
  ipcMain.handle("updates:check", () => updates.check());
  ipcMain.handle("updates:download", () => updates.download());
  ipcMain.handle("updates:install", async () => {
    quitting = true;
    await tunnel.stop();
    updates.install();
  });

  ipcMain.handle("app:get-versions", async () => {
    const currentSettings = await settings.get();
    return {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      cloudflared: await tunnel.getBinaryVersion(currentSettings),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      updateProvider: process.env.COOLTUNNEL_UPDATE_PROVIDER || process.env.LTC_UPDATE_PROVIDER || "GitHub Releases"
    };
  });
  ipcMain.handle("diagnostics:export", async (_event, options: DiagnosticOptions) => {
    const saveOptions: Electron.SaveDialogOptions = {
      title: "Export diagnostic bundle",
      defaultPath: `cooltunnel-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }]
    };
    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, saveOptions)
      : await dialog.showSaveDialog(saveOptions);
    if (result.canceled || !result.filePath) return null;
    const currentSettings = await settings.get();
    const versions = {
      app: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      cloudflared: await tunnel.getBinaryVersion(currentSettings),
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      updateProvider: process.env.COOLTUNNEL_UPDATE_PROVIDER || process.env.LTC_UPDATE_PROVIDER || "GitHub Releases"
    };
    const bundle = buildDiagnosticBundle({
      options,
      settings: currentSettings,
      profiles: await profiles.list(),
      tunnel: tunnel.getState(),
      logs: logs.get(),
      sites: await wordpress.scan(currentSettings.scanFolders),
      versions,
      brand: getBrandInfo(),
      runtimeMetrics: app.getAppMetrics().map((metric) => ({
        pid: metric.pid,
        type: metric.type,
        cpuPercent: metric.cpu.percentCPUUsage,
        workingSetKb: metric.memory.workingSetSize
      }))
    });
    await fs.writeFile(result.filePath, JSON.stringify(bundle, null, 2), "utf8");
    return result.filePath;
  });

  ipcMain.handle("logs:get", () => logs.get());
  ipcMain.handle("logs:clear", () => logs.clear());
  ipcMain.handle("app:copy-text", (_event, text: string) => clipboard.writeText(text));
  ipcMain.handle("app:get-brand", () => getBrandInfo());
  ipcMain.handle("app:open-external", async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error("Only http and https links can be opened.");
    await shell.openExternal(url);
  });
}

if (hasSingleInstanceLock) app.on("second-instance", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

if (hasSingleInstanceLock) app.whenReady()
  .then(async () => {
    await migrateLegacyUserData(app.getPath("userData"));
    profiles = new ProfileService(path.join(app.getPath("userData"), "profiles.json"));
    updates = new UpdateService(logs);
    registerIpc();
    createWindow();
    void settings.get().then((current) => updates.schedule(current.autoCheckUpdates));
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error) => {
    showStartupError(error);
  });

app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void settings.get().then(async (current) => {
    if (current.autoStopOnClose) await tunnel.stop();
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
