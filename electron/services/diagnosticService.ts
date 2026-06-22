import os from "node:os";
import path from "node:path";
import type {
  AppSettings,
  AppVersionInfo,
  BrandInfo,
  DiagnosticOptions,
  LogEntry,
  SiteProfile,
  TunnelState,
  WordPressSite
} from "../../shared/types";

const TOKEN_PATTERN = /(token|secret|password|authorization|bearer)[=:]\s*\S+/gi;

export function redactText(value: string, home: string): string {
  let redacted = value.replaceAll(home, "%USERPROFILE%");
  redacted = redacted.replace(TOKEN_PATTERN, "$1=[REDACTED]");
  redacted = redacted.replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%");
  return redacted;
}

export function buildDiagnosticBundle(input: {
  options: DiagnosticOptions;
  settings: AppSettings;
  profiles: SiteProfile[];
  tunnel: TunnelState;
  logs: LogEntry[];
  sites: WordPressSite[];
  versions: AppVersionInfo;
  brand?: BrandInfo;
  runtimeMetrics?: Array<{
    pid: number;
    type: string;
    cpuPercent: number;
    workingSetKb: number;
  }>;
  home?: string;
}) {
  const home = input.home ?? os.homedir();
  const includePaths = input.options.includePaths;
  const cleanPath = (value: string) => includePaths ? value : value ? "[REDACTED PATH]" : "";
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    includePaths,
    versions: input.versions,
    brand: input.brand,
    runtimeMetrics: input.runtimeMetrics ?? [],
    settings: {
      ...input.settings,
      cloudflaredPath: cleanPath(input.settings.cloudflaredPath),
      scanFolders: input.settings.scanFolders.map(cleanPath)
    },
    profiles: input.profiles.map((profile) => ({
      ...profile,
      wordpressPath: cleanPath(profile.wordpressPath)
    })),
    tunnel: {
      ...input.tunnel,
      command: input.tunnel.command ? redactText(input.tunnel.command, home) : null
    },
    sites: input.sites.map((site) => ({ ...site, path: cleanPath(site.path) })),
    logs: input.logs.slice(-500).map((entry) => ({
      ...entry,
      message: redactText(entry.message, home)
    }))
  };
}
