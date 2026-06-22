import { describe, expect, it } from "vitest";
import type { AppSettings, SiteProfile } from "../../shared/types";
import { buildDiagnosticBundle, redactText } from "./diagnosticService";

const settings: AppSettings = {
  settingsVersion: 2,
  cloudflaredPath: "C:\\Users\\Alice\\Tools\\cloudflared.exe",
  scanFolders: ["C:\\Users\\Alice\\Local Sites"],
  autoStopOnClose: true,
  keepWordPressFix: true,
  theme: "system",
  updateChannel: "stable",
  autoCheckUpdates: true
};

const profile: SiteProfile = {
  id: "1",
  name: "Demo",
  localUrl: "http://localhost/",
  wordpressPath: "C:\\Users\\Alice\\Local Sites\\Demo\\app\\public",
      sourceType: "localwp",
      routerMode: "auto",
  ignoreSsl: false,
  publicPath: "",
  fixHtaccess: false,
  keepWordPressFix: true,
  favorite: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01"
};

describe("diagnostic redaction", () => {
  it("redacts home directories and tokens from logs", () => {
    expect(redactText("C:\\Users\\Alice\\file token=secret-value", "C:\\Users\\Alice"))
      .toBe("%USERPROFILE%\\file token=[REDACTED]");
  });

  it("excludes filesystem paths by default", () => {
    const bundle = buildDiagnosticBundle({
      options: { includePaths: false },
      settings,
      profiles: [profile],
      tunnel: { status: "idle", publicUrl: null, error: null, command: null },
      logs: [],
      sites: [{ path: profile.wordpressPath, name: "Demo", source: "localwp" }],
      versions: { app: "1.1.0", electron: "42", chrome: "1", node: "24", cloudflared: "1", os: "Windows", updateProvider: "GitHub" },
      home: "C:\\Users\\Alice"
    });
    expect(bundle.settings.cloudflaredPath).toBe("[REDACTED PATH]");
    expect(bundle.profiles[0].wordpressPath).toBe("[REDACTED PATH]");
    expect(bundle.sites[0].path).toBe("[REDACTED PATH]");
  });

  it("includes paths only with explicit consent", () => {
    const bundle = buildDiagnosticBundle({
      options: { includePaths: true },
      settings,
      profiles: [profile],
      tunnel: { status: "idle", publicUrl: null, error: null, command: null },
      logs: [],
      sites: [],
      versions: { app: "1.1.0", electron: "42", chrome: "1", node: "24", cloudflared: "1", os: "Windows", updateProvider: "GitHub" }
    });
    expect(bundle.profiles[0].wordpressPath).toBe(profile.wordpressPath);
  });
});
