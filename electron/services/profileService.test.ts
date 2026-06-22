import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { legacyUrlToProfile } from "../../shared/profile";
import {
  createProfileExport,
  parseProfileExport,
  ProfileService
} from "./profileService";

let directory = "";
let filePath = "";

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "ltc-profiles-"));
  filePath = path.join(directory, "profiles.json");
});

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true });
});

describe("profile persistence and migration", () => {
  it("migrates the 1.0.2 remembered URL into a favorite profile", () => {
    expect(legacyUrlToProfile("https://plugins.test")).toMatchObject({
      name: "plugins.test",
      localUrl: "https://plugins.test/",
      ignoreSsl: true,
      routerMode: "auto",
      favorite: true
    });
  });

  it("creates, updates, duplicates, deletes, and persists profiles", async () => {
    const service = new ProfileService(filePath);
    const created = await service.create(legacyUrlToProfile("localhost/demo"));
    expect((await service.list())[0].id).toBe(created.id);
    const updated = await service.update(created.id, { name: "Demo Site" });
    expect(updated.name).toBe("Demo Site");
    const duplicate = await service.duplicate(created.id);
    expect(duplicate.name).toBe("Demo Site Copy");
    await service.remove(duplicate.id);
    expect(await service.list()).toHaveLength(1);
  });
});

describe("profile export and import", () => {
  it("excludes machine paths by default", async () => {
    const service = new ProfileService(filePath);
    await service.create({ ...legacyUrlToProfile("localhost/demo"), wordpressPath: "C:\\Users\\Example\\Local Sites\\Demo\\app\\public" });
    const exported = createProfileExport(await service.list(), false);
    expect(exported.includePaths).toBe(false);
    expect(exported.profiles[0]).not.toHaveProperty("wordpressPath");
  });

  it("includes paths only when requested", async () => {
    const service = new ProfileService(filePath);
    await service.create({ ...legacyUrlToProfile("localhost/demo"), wordpressPath: "D:\\Sites\\Demo" });
    expect(createProfileExport(await service.list(), true).profiles[0].wordpressPath).toBe("D:\\Sites\\Demo");
  });

  it("rejects unsupported schemas and unknown fields are ignored", () => {
    expect(() => parseProfileExport(JSON.stringify({ schemaVersion: 99, profiles: [] }))).toThrow(/Unsupported/);
    const parsed = parseProfileExport(JSON.stringify({
      schemaVersion: 1,
      profiles: [{ ...legacyUrlToProfile("localhost/demo"), id: "demo", createdAt: "x", updatedAt: "x", malicious: "ignored" }]
    }));
    expect(parsed.profiles[0]).not.toHaveProperty("malicious");
  });

  it("previews and applies overwrite or skip conflict strategies", async () => {
    const service = new ProfileService(filePath);
    const existing = await service.create(legacyUrlToProfile("localhost/one"));
    const importPath = path.join(directory, "import.json");
    await fs.writeFile(importPath, JSON.stringify({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      includePaths: false,
      profiles: [
        { ...existing, name: "Changed" },
        { ...existing, id: "new-id", name: "New" }
      ]
    }), "utf8");
    const preview = await service.previewImport(importPath);
    expect(preview).toMatchObject({ conflicts: 1, newProfiles: 1 });
    const result = await service.commitImport(importPath, "skip");
    expect(result).toEqual({ imported: 1, overwritten: 0, skipped: 1 });
  });

  it("rejects a file changed after import preview", async () => {
    const service = new ProfileService(filePath);
    const importPath = path.join(directory, "changed.json");
    await fs.writeFile(importPath, JSON.stringify({
      schemaVersion: 1,
      profiles: [{ ...legacyUrlToProfile("localhost/one"), id: "one" }]
    }), "utf8");
    await service.previewImport(importPath);
    await fs.writeFile(importPath, JSON.stringify({ schemaVersion: 1, profiles: [] }), "utf8");
    await expect(service.commitImport(importPath, "skip")).rejects.toThrow(/changed after preview/);
  });
});
