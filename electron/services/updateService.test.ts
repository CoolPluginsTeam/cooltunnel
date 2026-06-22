import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { isPackaged: true, getVersion: () => "1.1.0" },
  BrowserWindow: { getAllWindows: () => [] }
}));

vi.mock("electron-updater", () => ({
  autoUpdater: {}
}));

class FakeUpdater extends EventEmitter {
  autoDownload = true;
  autoInstallOnAppQuit = true;
  checkForUpdates = vi.fn(async () => null);
  downloadUpdate = vi.fn(async () => []);
  quitAndInstall = vi.fn();
}

const logs = { add: vi.fn() };

describe("update state workflow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports available, downloading, and downloaded states", async () => {
    const { UpdateService } = await import("./updateService");
    const updater = new FakeUpdater();
    const service = new UpdateService(logs as never, updater as never, true, true);
    updater.emit("update-available", { version: "1.2.0", releaseName: "Team release", releaseNotes: "Notes" });
    expect(service.getState()).toMatchObject({ status: "available", availableVersion: "1.2.0" });
    await service.download();
    updater.emit("download-progress", { percent: 42 });
    expect(service.getState()).toMatchObject({ status: "downloading", percent: 42 });
    updater.emit("update-downloaded", { version: "1.2.0" });
    expect(service.getState()).toMatchObject({ status: "downloaded", percent: 100 });
    service.install();
    expect(updater.quitAndInstall).toHaveBeenCalled();
  });

  it("reports no update", async () => {
    const { UpdateService } = await import("./updateService");
    const updater = new FakeUpdater();
    const service = new UpdateService(logs as never, updater as never, true, true);
    updater.emit("update-not-available", { version: "1.1.0" });
    expect(service.getState().status).toBe("not-available");
  });

  it("handles offline checks and invalid metadata", async () => {
    const { UpdateService } = await import("./updateService");
    const updater = new FakeUpdater();
    updater.checkForUpdates.mockRejectedValueOnce(new Error("offline"));
    const service = new UpdateService(logs as never, updater as never, true, true);
    await service.check();
    expect(service.getState()).toMatchObject({ status: "error", error: "offline" });
    updater.emit("update-available", {});
    expect(service.getState().error).toMatch(/valid version/);
  });

  it("is disabled in development builds", async () => {
    const { UpdateService } = await import("./updateService");
    const service = new UpdateService(logs as never, new FakeUpdater() as never, false, false);
    await service.check();
    expect(service.getState().status).toBe("disabled");
  });
});
