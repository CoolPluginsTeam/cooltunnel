import { app } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppSettings } from "../../shared/types";

export const DEFAULT_SCAN_FOLDERS = [
  "C:\\laragon\\www",
  "D:\\laragon\\www",
  "C:\\xampp\\htdocs",
  "D:\\xampp\\htdocs",
  "C:\\wamp64\\www",
  "D:\\wamp64\\www",
  "C:\\wamp\\www",
  "D:\\wamp\\www"
];

export const CURRENT_SETTINGS_VERSION = 3;

export function createDefaultSettings(localSitesRoot: string): AppSettings {
  return {
  settingsVersion: CURRENT_SETTINGS_VERSION,
  cloudflaredPath: "",
  scanFolders: [...DEFAULT_SCAN_FOLDERS, localSitesRoot],
  autoStopOnClose: true,
  keepWordPressFix: true,
  theme: "system",
  updateChannel: "stable",
  autoCheckUpdates: true
  };
}

export function normalizeSettings(
  saved: Partial<AppSettings>,
  localSitesRoot: string
): AppSettings {
  const defaults = createDefaultSettings(localSitesRoot);
  const previousVersion = typeof saved.settingsVersion === "number" ? saved.settingsVersion : 1;
  const rawFolders = Array.isArray(saved.scanFolders) ? saved.scanFolders : defaults.scanFolders;
  const migratedFolders = previousVersion < CURRENT_SETTINGS_VERSION
    ? [...rawFolders, localSitesRoot]
    : rawFolders;
  const theme = ["light", "dark", "system"].includes(saved.theme ?? "")
    ? saved.theme!
    : "system";

  return {
    settingsVersion: CURRENT_SETTINGS_VERSION,
    cloudflaredPath: typeof saved.cloudflaredPath === "string" ? saved.cloudflaredPath.trim() : "",
    scanFolders: [...new Set(
      migratedFolders
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
    )],
    autoStopOnClose: saved.autoStopOnClose !== false,
    keepWordPressFix: saved.keepWordPressFix !== false,
    theme,
    updateChannel: "stable",
    autoCheckUpdates: saved.autoCheckUpdates !== false
  };
}

export class SettingsService {
  private get localSitesRoot() {
    return path.join(app.getPath("home"), "Local Sites");
  }

  private get filePath() {
    return path.join(app.getPath("userData"), "settings.json");
  }

  async get(): Promise<AppSettings> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      return normalizeSettings(saved, this.localSitesRoot);
    } catch {
      return createDefaultSettings(this.localSitesRoot);
    }
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = normalizeSettings({ ...(await this.get()), ...patch }, this.localSitesRoot);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(next, null, 2), "utf8");
    await fs.rename(temporaryPath, this.filePath);
    return next;
  }

  async reset(): Promise<AppSettings> {
    return this.update(createDefaultSettings(this.localSitesRoot));
  }
}
