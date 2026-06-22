import { promises as fs } from "node:fs";
import path from "node:path";

export const DATA_MIGRATION_VERSION = 2;
export const MIGRATION_STATE_FILE = "migration-state.json";

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mergeProfiles(legacyPath: string, currentPath: string): Promise<void> {
  const legacy = JSON.parse(await fs.readFile(legacyPath, "utf8")) as {
    schemaVersion?: number;
    profiles?: Array<{ id?: string; updatedAt?: string }>;
  };
  if (!Array.isArray(legacy.profiles)) return;
  if (!(await exists(currentPath))) {
    await fs.copyFile(legacyPath, currentPath);
    return;
  }
  const current = JSON.parse(await fs.readFile(currentPath, "utf8")) as {
    schemaVersion?: number;
    profiles?: Array<{ id?: string; updatedAt?: string }>;
  };
  if (!Array.isArray(current.profiles)) {
    await fs.copyFile(legacyPath, currentPath);
    return;
  }
  const profiles = new Map<string, { id?: string; updatedAt?: string }>();
  for (const profile of [...legacy.profiles, ...current.profiles]) {
    const key = typeof profile.id === "string" && profile.id ? profile.id : JSON.stringify(profile);
    const previous = profiles.get(key);
    if (!previous || String(profile.updatedAt ?? "") >= String(previous.updatedAt ?? "")) {
      profiles.set(key, profile);
    }
  }
  await fs.writeFile(currentPath, JSON.stringify({
    schemaVersion: Math.max(legacy.schemaVersion ?? 1, current.schemaVersion ?? 1),
    profiles: [...profiles.values()]
  }, null, 2), "utf8");
}

export async function migrateLegacyUserData(currentUserData: string): Promise<void> {
  const parent = path.dirname(currentUserData);
  const currentName = path.basename(currentUserData);
  const statePath = path.join(currentUserData, MIGRATION_STATE_FILE);
  try {
    const state = JSON.parse(await fs.readFile(statePath, "utf8")) as { version?: number; completed?: boolean };
    if (state.version === DATA_MIGRATION_VERSION && state.completed === true) return;
  } catch {
    // A missing or invalid state file means migration should run.
  }
  const legacyNames = ["local-to-cloud", "Local to Cloud", "CoolTunnel"].filter(
    (name) => name.toLowerCase() !== currentName.toLowerCase() || name !== currentName
  );
  await fs.mkdir(currentUserData, { recursive: true });
  const migratedSources: string[] = [];

  for (const name of legacyNames) {
    const legacyRoot = path.join(parent, name);
    if (path.resolve(legacyRoot) === path.resolve(currentUserData) || !(await exists(legacyRoot))) continue;
    migratedSources.push(legacyRoot);
    const legacyProfiles = path.join(legacyRoot, "profiles.json");
    if (await exists(legacyProfiles)) {
      await mergeProfiles(legacyProfiles, path.join(currentUserData, "profiles.json"));
    }
    for (const fileName of ["settings.json", "startup-error.log"]) {
      const source = path.join(legacyRoot, fileName);
      const destination = path.join(currentUserData, fileName);
      if ((await exists(source)) && !(await exists(destination))) {
        await fs.copyFile(source, destination);
      }
    }
    for (const directoryName of ["Local Storage"]) {
      const source = path.join(legacyRoot, directoryName);
      const destination = path.join(currentUserData, directoryName);
      if ((await exists(source)) && !(await exists(destination))) {
        await fs.cp(source, destination, { recursive: true });
      }
    }
  }
  await fs.writeFile(statePath, JSON.stringify({
    version: DATA_MIGRATION_VERSION,
    completed: true,
    completedAt: new Date().toISOString(),
    sources: migratedSources
  }, null, 2), "utf8");
}
