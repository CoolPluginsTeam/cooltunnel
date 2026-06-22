import { BRAND } from "../../shared/brand";
import { parseLocalUrl } from "../../shared/tunnel";
import type { CoolTunnelApi, TunnelState, UpdateState } from "../../shared/types";

const tunnelState: TunnelState = {
  status: "idle",
  publicUrl: null,
  error: null,
  command: null
};

const updateState: UpdateState = {
  status: "disabled",
  currentVersion: "2.0.0",
  availableVersion: null,
  releaseName: null,
  releaseNotes: null,
  percent: null,
  error: null
};

export const mockApi: CoolTunnelApi = {
  tunnel: {
    parseUrl: async (url) => parseLocalUrl(url),
    start: async () => tunnelState,
    stop: async () => tunnelState,
    getState: async () => tunnelState,
    onState: () => () => undefined
  },
  wordpress: {
    scan: async () => [],
    chooseFolder: async () => null,
    validate: async () => false,
    applyFix: async () => [],
    removeFix: async () => [],
    checkCompatibility: async (publicUrl) => ({
      status: "compatible",
      checkedUrl: publicUrl,
      localReferences: [],
      message: "Preview mode"
    })
  },
  settings: {
    get: async () => ({
      settingsVersion: 3,
      cloudflaredPath: "",
      scanFolders: [],
      autoStopOnClose: true,
      keepWordPressFix: true,
      theme: "light",
      updateChannel: "stable",
      autoCheckUpdates: true
    }),
    update: async (patch) => ({
      settingsVersion: 3,
      cloudflaredPath: "",
      scanFolders: [],
      autoStopOnClose: true,
      keepWordPressFix: true,
      theme: "light",
      updateChannel: "stable",
      autoCheckUpdates: true,
      ...patch
    }),
    reset: async () => mockApi.settings.get()
  },
  profiles: {
    list: async () => [],
    create: async () => { throw new Error("Preview mode"); },
    update: async () => { throw new Error("Preview mode"); },
    remove: async () => undefined,
    duplicate: async () => { throw new Error("Preview mode"); },
    export: async () => null,
    previewImport: async () => null,
    commitImport: async () => ({ imported: 0, overwritten: 0, skipped: 0 })
  },
  updates: {
    getState: async () => updateState,
    check: async () => updateState,
    download: async () => undefined,
    install: async () => undefined,
    onState: () => () => undefined
  },
  diagnostics: { export: async () => null },
  logs: {
    get: async () => [],
    clear: async () => undefined,
    onEntry: () => () => undefined,
    onClear: () => () => undefined
  },
  app: {
    openExternal: async () => undefined,
    copyText: async () => undefined,
    getVersions: async () => ({
      app: "2.0.0",
      electron: "42",
      chrome: "142",
      node: "24",
      cloudflared: "Preview",
      os: "Windows 11",
      updateProvider: "GitHub Releases"
    }),
    getBrand: async () => BRAND
  }
};
