import { describe, expect, it } from "vitest";
import { CURRENT_SETTINGS_VERSION, normalizeSettings } from "./settingsService";

describe("settings migration", () => {
  const localSitesRoot = "C:\\Users\\Example\\Local Sites";

  it("adds the LocalWP root once when migrating 1.0.1 settings", () => {
    const migrated = normalizeSettings({
      scanFolders: ["C:\\laragon\\www"]
    }, localSitesRoot);
    expect(migrated.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
    expect(migrated.scanFolders).toEqual(["C:\\laragon\\www", localSitesRoot]);
  });

  it("does not restore a LocalWP root removed after migration", () => {
    const normalized = normalizeSettings({
      settingsVersion: CURRENT_SETTINGS_VERSION,
      scanFolders: ["C:\\laragon\\www"]
    }, localSitesRoot);
    expect(normalized.scanFolders).toEqual(["C:\\laragon\\www"]);
  });

  it("deduplicates scan roots", () => {
    const normalized = normalizeSettings({
      settingsVersion: 1,
      scanFolders: [localSitesRoot, localSitesRoot]
    }, localSitesRoot);
    expect(normalized.scanFolders).toEqual([localSitesRoot]);
  });
});
