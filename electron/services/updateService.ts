import { app, BrowserWindow } from "electron";
import { autoUpdater, type AppUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";
import { existsSync } from "node:fs";
import path from "node:path";
import type { UpdateState } from "../../shared/types";
import type { LogService } from "./logService";

function notesToText(notes: UpdateInfo["releaseNotes"]): string | null {
  if (!notes) return null;
  if (typeof notes === "string") return notes;
  return notes.map((note) => `${note.version ?? ""}\n${note.note ?? ""}`.trim()).join("\n\n");
}

export class UpdateService {
  private state: UpdateState;
  private scheduled = false;
  private readonly updater: AppUpdater | null;

  constructor(
    private readonly logs: LogService,
    updater?: AppUpdater,
    private readonly packaged = app.isPackaged,
    private readonly providerConfigured = packaged && existsSync(path.join(process.resourcesPath, "app-update.yml"))
  ) {
    this.updater = updater ?? (providerConfigured ? autoUpdater : null);
    this.state = {
      status: packaged && providerConfigured ? "idle" : "disabled",
      currentVersion: app.getVersion(),
      availableVersion: null,
      releaseName: null,
      releaseNotes: null,
      percent: null,
      error: null
    };
    if (this.updater) {
      this.updater.autoDownload = false;
      this.updater.autoInstallOnAppQuit = false;
      this.registerEvents();
    }
  }

  getState(): UpdateState {
    return { ...this.state };
  }

  schedule(enabled: boolean): void {
    if (!enabled || !this.packaged || !this.providerConfigured || this.scheduled) return;
    this.scheduled = true;
    setTimeout(() => void this.check(), 10_000);
    setInterval(() => void this.check(), 6 * 60 * 60 * 1000);
  }

  async check(): Promise<UpdateState> {
    if (!this.packaged || !this.providerConfigured) {
      this.setState({
        ...this.state,
        status: "disabled",
        error: this.packaged
          ? "This build does not include an update provider."
          : "Updates are available in installed release builds only."
      });
      return this.getState();
    }
    this.setState({ ...this.state, status: "checking", error: null, percent: null });
    try {
      await this.updater!.checkForUpdates();
    } catch (error) {
      this.fail(error);
    }
    return this.getState();
  }

  async download(): Promise<void> {
    if (this.state.status !== "available") throw new Error("No update is available to download.");
    this.setState({ ...this.state, status: "downloading", percent: 0, error: null });
    try {
      await this.updater!.downloadUpdate();
    } catch (error) {
      this.fail(error);
      throw error;
    }
  }

  install(): void {
    if (this.state.status !== "downloaded") throw new Error("The update has not finished downloading.");
    this.updater!.quitAndInstall(false, true);
  }

  private registerEvents(): void {
    if (!this.updater) return;
    this.updater.on("update-available", (info: UpdateInfo) => {
      if (!info || typeof info.version !== "string" || !info.version.trim()) {
        this.fail(new Error("Update metadata does not contain a valid version."));
        return;
      }
      this.logs.add("info", `Update ${info.version} is available.`);
      this.setState({
        ...this.state,
        status: "available",
        availableVersion: info.version,
        releaseName: info.releaseName ? String(info.releaseName) : null,
        releaseNotes: notesToText(info.releaseNotes),
        percent: null,
        error: null
      });
    });
    this.updater.on("update-not-available", () => {
      this.logs.add("info", "CoolTunnel is up to date.");
      this.setState({
        ...this.state,
        status: "not-available",
        availableVersion: null,
        releaseName: null,
        releaseNotes: null,
        percent: null,
        error: null
      });
    });
    this.updater.on("download-progress", (progress: ProgressInfo) => {
      this.setState({ ...this.state, status: "downloading", percent: Math.round(progress.percent), error: null });
    });
    this.updater.on("update-downloaded", (info: UpdateInfo) => {
      this.logs.add("success", `Update ${info.version} is ready to install.`);
      this.setState({
        ...this.state,
        status: "downloaded",
        availableVersion: info.version,
        percent: 100,
        error: null
      });
    });
    this.updater.on("error", (error: Error) => this.fail(error));
  }

  private fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logs.add("error", `Update error: ${message}`);
    this.setState({ ...this.state, status: "error", error: message, percent: null });
  }

  private setState(state: UpdateState): void {
    this.state = state;
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("updates:state", this.getState());
    }
  }
}
