import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_MIGRATION_VERSION, migrateLegacyUserData, MIGRATION_STATE_FILE } from "./dataMigrationService";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true })
  ));
});

describe("application data migration", () => {
  it("copies legacy profiles without replacing current settings", async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "ltc-data-"));
    directories.push(parent);
    const legacy = path.join(parent, "local-to-cloud");
    const current = path.join(parent, "Local to Cloud");
    await fs.mkdir(legacy);
    await fs.mkdir(current);
    await fs.writeFile(path.join(legacy, "profiles.json"), JSON.stringify({
      schemaVersion: 1,
      profiles: [{ id: "legacy", updatedAt: "2026-01-01" }]
    }), "utf8");
    await fs.writeFile(path.join(legacy, "settings.json"), "{\"legacy\":true}", "utf8");
    await fs.writeFile(path.join(current, "settings.json"), "{\"current\":true}", "utf8");

    await migrateLegacyUserData(current);

    expect(JSON.parse(await fs.readFile(path.join(current, "profiles.json"), "utf8")).profiles)
      .toContainEqual({ id: "legacy", updatedAt: "2026-01-01" });
    expect(await fs.readFile(path.join(current, "settings.json"), "utf8")).toBe("{\"current\":true}");
    expect(JSON.parse(await fs.readFile(path.join(current, MIGRATION_STATE_FILE), "utf8"))).toMatchObject({
      version: DATA_MIGRATION_VERSION,
      completed: true
    });
  });

  it("runs only once after a completed migration", async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "ct-data-"));
    directories.push(parent);
    const legacy = path.join(parent, "local-to-cloud");
    const current = path.join(parent, "CoolTunnel");
    await fs.mkdir(legacy);
    await fs.writeFile(path.join(legacy, "settings.json"), "{\"first\":true}", "utf8");
    await migrateLegacyUserData(current);
    await fs.writeFile(path.join(legacy, "settings.json"), "{\"second\":true}", "utf8");
    await migrateLegacyUserData(current);
    expect(await fs.readFile(path.join(current, "settings.json"), "utf8")).toBe("{\"first\":true}");
  });
});
