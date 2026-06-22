import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ProfileConflictStrategy,
  ProfileExport,
  ProfileImportPreview,
  ProfileImportResult,
  ProfileSourceType,
  RouterMode,
  SiteProfile
} from "../../shared/types";
import { normalizePathname, parseLocalUrl } from "../../shared/tunnel";

export const PROFILE_SCHEMA_VERSION = 2;

type NewProfile = Omit<SiteProfile, "id" | "createdAt" | "updatedAt">;

function isSourceType(value: unknown): value is ProfileSourceType {
  return ["laragon", "xampp", "wamp", "localwp", "manual", "unknown"].includes(String(value));
}

function isRouterMode(value: unknown): value is RouterMode {
  return ["auto", "site-domain", "localhost"].includes(String(value));
}

export function sanitizeProfileInput(input: Partial<SiteProfile>, now = new Date().toISOString()): SiteProfile {
  const parsed = parseLocalUrl(String(input.localUrl ?? ""));
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("Profile name is required.");
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : randomUUID(),
    name: name.slice(0, 80),
    localUrl: parsed.originalUrl,
    wordpressPath: typeof input.wordpressPath === "string" ? input.wordpressPath.trim() : "",
    sourceType: isSourceType(input.sourceType) ? input.sourceType : "unknown",
    routerMode: isRouterMode(input.routerMode) ? input.routerMode : "auto",
    ignoreSsl: typeof input.ignoreSsl === "boolean" ? input.ignoreSsl : parsed.ignoreSsl,
    publicPath: normalizePathname(typeof input.publicPath === "string" ? input.publicPath : parsed.pathname),
    fixHtaccess: input.fixHtaccess === true,
    keepWordPressFix: input.keepWordPressFix !== false,
    favorite: input.favorite === true,
    createdAt: typeof input.createdAt === "string" && input.createdAt ? input.createdAt : now,
    updatedAt: now
  };
}

export function createProfileExport(profiles: SiteProfile[], includePaths: boolean): ProfileExport {
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    includePaths,
    profiles: profiles.map((profile) => {
      if (includePaths) return { ...profile };
      const { wordpressPath: _wordpressPath, ...safe } = profile;
      return safe;
    })
  };
}

export function parseProfileExport(raw: string): { profiles: SiteProfile[]; invalid: string[]; schemaVersion: number } {
  const value = JSON.parse(raw) as Partial<ProfileExport>;
  if (value.schemaVersion !== 1 && value.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error(`Unsupported profile export schema: ${String(value.schemaVersion)}.`);
  }
  if (!Array.isArray(value.profiles)) throw new Error("Profile export does not contain a profiles array.");

  const profiles: SiteProfile[] = [];
  const invalid: string[] = [];
  for (let index = 0; index < value.profiles.length; index += 1) {
    try {
      profiles.push(sanitizeProfileInput(value.profiles[index] as Partial<SiteProfile>));
    } catch (error) {
      invalid.push(`Profile ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { profiles, invalid, schemaVersion: value.schemaVersion };
}

export class ProfileService {
  private readonly approvedImports = new Map<string, string>();

  constructor(private readonly filePath: string) {}

  async list(): Promise<SiteProfile[]> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as { schemaVersion?: number; profiles?: SiteProfile[] };
      if (![1, PROFILE_SCHEMA_VERSION].includes(parsed.schemaVersion ?? 0) || !Array.isArray(parsed.profiles)) return [];
      return parsed.profiles.map((profile) => sanitizeProfileInput(profile, profile.updatedAt));
    } catch {
      return [];
    }
  }

  async create(input: NewProfile): Promise<SiteProfile> {
    const profile = sanitizeProfileInput(input);
    const profiles = await this.list();
    profiles.push(profile);
    await this.write(profiles);
    return profile;
  }

  async update(id: string, patch: Partial<SiteProfile>): Promise<SiteProfile> {
    const profiles = await this.list();
    const index = profiles.findIndex((profile) => profile.id === id);
    if (index < 0) throw new Error("Profile was not found.");
    const updated = sanitizeProfileInput({
      ...profiles[index],
      ...patch,
      id,
      createdAt: profiles[index].createdAt
    });
    profiles[index] = updated;
    await this.write(profiles);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const profiles = await this.list();
    const next = profiles.filter((profile) => profile.id !== id);
    if (next.length === profiles.length) throw new Error("Profile was not found.");
    await this.write(next);
  }

  async duplicate(id: string): Promise<SiteProfile> {
    const source = (await this.list()).find((profile) => profile.id === id);
    if (!source) throw new Error("Profile was not found.");
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...copy } = source;
    return this.create({ ...copy, name: `${source.name} Copy`, favorite: false });
  }

  async previewImport(filePath: string): Promise<ProfileImportPreview> {
    const resolvedFilePath = path.resolve(filePath);
    const raw = await fs.readFile(resolvedFilePath, "utf8");
    const parsed = parseProfileExport(raw);
    this.approvedImports.set(resolvedFilePath, createHash("sha256").update(raw).digest("hex"));
    const existing = await this.list();
    const existingIds = new Set(existing.map((profile) => profile.id));
    return {
      filePath: resolvedFilePath,
      schemaVersion: parsed.schemaVersion,
      total: parsed.profiles.length + parsed.invalid.length,
      newProfiles: parsed.profiles.filter((profile) => !existingIds.has(profile.id)).length,
      conflicts: parsed.profiles.filter((profile) => existingIds.has(profile.id)).length,
      invalid: parsed.invalid,
      profiles: parsed.profiles
    };
  }

  async commitImport(filePath: string, strategy: ProfileConflictStrategy): Promise<ProfileImportResult> {
    const resolvedFilePath = path.resolve(filePath);
    const approvedHash = this.approvedImports.get(resolvedFilePath);
    if (!approvedHash) {
      throw new Error("Import file must be selected and previewed first.");
    }
    const raw = await fs.readFile(resolvedFilePath, "utf8");
    const currentHash = createHash("sha256").update(raw).digest("hex");
    this.approvedImports.delete(resolvedFilePath);
    if (currentHash !== approvedHash) {
      throw new Error("The profile file changed after preview. Select it again before importing.");
    }
    const parsed = parseProfileExport(raw);
    const profiles = await this.list();
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    let imported = 0;
    let overwritten = 0;
    let skipped = parsed.invalid.length;

    for (const profile of parsed.profiles) {
      if (byId.has(profile.id)) {
        if (strategy === "skip") {
          skipped += 1;
          continue;
        }
        byId.set(profile.id, sanitizeProfileInput({ ...profile, createdAt: byId.get(profile.id)!.createdAt }));
        overwritten += 1;
      } else {
        byId.set(profile.id, profile);
        imported += 1;
      }
    }
    await this.write([...byId.values()]);
    return { imported, overwritten, skipped };
  }

  private async write(profiles: SiteProfile[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({
      schemaVersion: PROFILE_SCHEMA_VERSION,
      profiles
    }, null, 2), "utf8");
    await fs.rename(temporary, this.filePath);
  }
}
