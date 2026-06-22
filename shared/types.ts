export type TunnelStatus = "idle" | "starting" | "active" | "stopped" | "error";
export type ThemePreference = "light" | "dark" | "system";
export type ProfileSourceType = "laragon" | "xampp" | "wamp" | "localwp" | "manual" | "unknown";
export type RouterMode = "auto" | "site-domain" | "localhost";
export type DetectedRouterMode = Exclude<RouterMode, "auto">;
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error"
  | "disabled";

export interface BrandInfo {
  schemaVersion: number;
  productName: string;
  lockup: string;
  tagline: string;
  publisher: string;
  companyBrand: string;
  author: string;
  credit: string;
  appId: string;
  legacyAppId: string;
  packageName: string;
  executableName: string;
  installerName: string;
  releaseArtifactName: string;
  copyright: string;
  license: string;
  urls: {
    product: string;
    company: string;
    documentation: string;
    support: string;
    privacy: string;
    license: string;
    thirdPartyNotices: string;
    releaseNotes: string;
    source: string;
    releases: string;
  };
  assets: {
    icon: string;
    horizontalLogo: string;
    stackedLogo: string;
    monochromeLogo: string;
    socialPreview: string;
  };
}

export interface ParsedLocalUrl {
  originalUrl: string;
  protocol: "http" | "https";
  host: string;
  port: number;
  origin: string;
  hostHeader: string;
  pathname: string;
  ignoreSsl: boolean;
  routerMode: DetectedRouterMode;
}

export interface TunnelStartOptions {
  localUrl: string;
  ignoreSsl: boolean;
  routerMode?: RouterMode;
}

export interface TunnelState {
  status: TunnelStatus;
  publicUrl: string | null;
  error: string | null;
  command: string | null;
}

export interface LogEntry {
  id: string;
  time: string;
  level: "info" | "output" | "error" | "success";
  message: string;
}

export interface AppSettings {
  settingsVersion: number;
  cloudflaredPath: string;
  scanFolders: string[];
  autoStopOnClose: boolean;
  keepWordPressFix: boolean;
  theme: ThemePreference;
  updateChannel: "stable";
  autoCheckUpdates: boolean;
}

export interface WordPressSite {
  path: string;
  name: string;
  source: "scan" | "guessed" | "manual" | "localwp";
}

export interface WordPressEditResult {
  success: boolean;
  path: string;
  backupPath?: string;
  message: string;
}

export interface StopTunnelOptions {
  removeSessionFixes: boolean;
}

export interface SiteProfile {
  id: string;
  name: string;
  localUrl: string;
  wordpressPath: string;
  sourceType: ProfileSourceType;
  routerMode: RouterMode;
  ignoreSsl: boolean;
  publicPath: string;
  fixHtaccess: boolean;
  keepWordPressFix: boolean;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileExport {
  schemaVersion: 1 | 2;
  exportedAt: string;
  includePaths: boolean;
  profiles: Array<Omit<SiteProfile, "wordpressPath"> & { wordpressPath?: string }>;
}

export interface ProfileImportPreview {
  filePath: string;
  schemaVersion: number;
  total: number;
  newProfiles: number;
  conflicts: number;
  invalid: string[];
  profiles: SiteProfile[];
}

export type ProfileConflictStrategy = "overwrite" | "skip";

export interface ProfileImportResult {
  imported: number;
  overwritten: number;
  skipped: number;
}

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
  percent: number | null;
  error: string | null;
}

export interface DiagnosticOptions {
  includePaths: boolean;
}

export interface AppVersionInfo {
  app: string;
  electron: string;
  chrome: string;
  node: string;
  cloudflared: string;
  os: string;
  updateProvider: string;
}

export interface CompatibilityReport {
  status: "compatible" | "fix-required" | "error";
  checkedUrl: string;
  localReferences: string[];
  message: string;
}

export interface CoolTunnelApi {
  tunnel: {
    parseUrl: (url: string) => Promise<ParsedLocalUrl>;
    start: (options: TunnelStartOptions) => Promise<TunnelState>;
    stop: (options?: StopTunnelOptions) => Promise<TunnelState>;
    getState: () => Promise<TunnelState>;
    onState: (callback: (state: TunnelState) => void) => () => void;
  };
  wordpress: {
    scan: (siteHint?: string) => Promise<WordPressSite[]>;
    chooseFolder: () => Promise<WordPressSite | null>;
    validate: (folder: string) => Promise<boolean>;
    applyFix: (folder: string, fixHtaccess: boolean, pathname?: string, localUrl?: string) => Promise<WordPressEditResult[]>;
    removeFix: (folder: string, removeHtaccess: boolean) => Promise<WordPressEditResult[]>;
    checkCompatibility: (publicUrl: string, localUrl: string) => Promise<CompatibilityReport>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (patch: Partial<AppSettings>) => Promise<AppSettings>;
    reset: () => Promise<AppSettings>;
  };
  profiles: {
    list: () => Promise<SiteProfile[]>;
    create: (profile: Omit<SiteProfile, "id" | "createdAt" | "updatedAt">) => Promise<SiteProfile>;
    update: (id: string, patch: Partial<SiteProfile>) => Promise<SiteProfile>;
    remove: (id: string) => Promise<void>;
    duplicate: (id: string) => Promise<SiteProfile>;
    export: (includePaths: boolean) => Promise<string | null>;
    previewImport: () => Promise<ProfileImportPreview | null>;
    commitImport: (filePath: string, strategy: ProfileConflictStrategy) => Promise<ProfileImportResult>;
  };
  updates: {
    getState: () => Promise<UpdateState>;
    check: () => Promise<UpdateState>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onState: (callback: (state: UpdateState) => void) => () => void;
  };
  diagnostics: {
    export: (options: DiagnosticOptions) => Promise<string | null>;
  };
  logs: {
    get: () => Promise<LogEntry[]>;
    clear: () => Promise<void>;
    onEntry: (callback: (entry: LogEntry) => void) => () => void;
    onClear: (callback: () => void) => () => void;
  };
  app: {
    openExternal: (url: string) => Promise<void>;
    copyText: (text: string) => Promise<void>;
    getVersions: () => Promise<AppVersionInfo>;
    getBrand: () => Promise<BrandInfo>;
  };
}

/** @deprecated Kept for source compatibility with 1.x integrations. */
export type LocalToCloudApi = CoolTunnelApi;
