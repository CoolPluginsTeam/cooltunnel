import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  DiagnosticOptions,
  CoolTunnelApi,
  LogEntry,
  ProfileConflictStrategy,
  SiteProfile,
  StopTunnelOptions,
  TunnelStartOptions,
  TunnelState
} from "../shared/types";

const api: CoolTunnelApi = {
  tunnel: {
    parseUrl: (url) => ipcRenderer.invoke("tunnel:parse-url", url),
    start: (options: TunnelStartOptions) => ipcRenderer.invoke("tunnel:start", options),
    stop: (options?: StopTunnelOptions) => ipcRenderer.invoke("tunnel:stop", options),
    getState: () => ipcRenderer.invoke("tunnel:get-state"),
    onState: (callback: (state: TunnelState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: TunnelState) => callback(state);
      ipcRenderer.on("tunnel:state", listener);
      return () => ipcRenderer.removeListener("tunnel:state", listener);
    }
  },
  wordpress: {
    scan: (host) => ipcRenderer.invoke("wordpress:scan", host),
    chooseFolder: () => ipcRenderer.invoke("wordpress:choose-folder"),
    validate: (folder) => ipcRenderer.invoke("wordpress:validate", folder),
    applyFix: (folder, fixHtaccess, pathname, localUrl) =>
      ipcRenderer.invoke("wordpress:apply", folder, fixHtaccess, pathname, localUrl),
    removeFix: (folder, removeHtaccess) => ipcRenderer.invoke("wordpress:remove", folder, removeHtaccess),
    checkCompatibility: (publicUrl, localUrl) =>
      ipcRenderer.invoke("wordpress:check-compatibility", publicUrl, localUrl)
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch: Partial<AppSettings>) => ipcRenderer.invoke("settings:update", patch),
    reset: () => ipcRenderer.invoke("settings:reset")
  },
  profiles: {
    list: () => ipcRenderer.invoke("profiles:list"),
    create: (profile) => ipcRenderer.invoke("profiles:create", profile),
    update: (id: string, patch: Partial<SiteProfile>) => ipcRenderer.invoke("profiles:update", id, patch),
    remove: (id: string) => ipcRenderer.invoke("profiles:remove", id),
    duplicate: (id: string) => ipcRenderer.invoke("profiles:duplicate", id),
    export: (includePaths: boolean) => ipcRenderer.invoke("profiles:export", includePaths),
    previewImport: () => ipcRenderer.invoke("profiles:preview-import"),
    commitImport: (filePath: string, strategy: ProfileConflictStrategy) =>
      ipcRenderer.invoke("profiles:commit-import", filePath, strategy)
  },
  updates: {
    getState: () => ipcRenderer.invoke("updates:get-state"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    onState: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]) => callback(state);
      ipcRenderer.on("updates:state", listener);
      return () => ipcRenderer.removeListener("updates:state", listener);
    }
  },
  diagnostics: {
    export: (options: DiagnosticOptions) => ipcRenderer.invoke("diagnostics:export", options)
  },
  logs: {
    get: () => ipcRenderer.invoke("logs:get"),
    clear: () => ipcRenderer.invoke("logs:clear"),
    onEntry: (callback: (entry: LogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entries: LogEntry[]) => {
        for (const entry of entries) callback(entry);
      };
      ipcRenderer.on("logs:entries", listener);
      return () => ipcRenderer.removeListener("logs:entries", listener);
    },
    onClear: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("logs:cleared", listener);
      return () => ipcRenderer.removeListener("logs:cleared", listener);
    }
  },
  app: {
    openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
    copyText: (text) => ipcRenderer.invoke("app:copy-text", text),
    getVersions: () => ipcRenderer.invoke("app:get-versions"),
    getBrand: () => ipcRenderer.invoke("app:get-brand")
  }
};

contextBridge.exposeInMainWorld("coolTunnel", api);
contextBridge.exposeInMainWorld("localToCloud", api);
