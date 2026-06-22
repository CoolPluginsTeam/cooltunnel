import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CompatibilityReport,
  WordPressEditResult,
  WordPressSite
} from "../../shared/types";
import { normalizePathname, parseLocalUrl } from "../../shared/tunnel";

const WP_BEGIN = "// BEGIN COOLTUNNEL WORDPRESS FIX";
const WP_END = "// END COOLTUNNEL WORDPRESS FIX";
const HT_BEGIN = "# BEGIN COOLTUNNEL WP-ADMIN FIX";
const HT_END = "# END COOLTUNNEL WP-ADMIN FIX";
const LEGACY_WP_BEGIN = "// BEGIN LOCAL TO CLOUD TUNNEL FIX";
const LEGACY_WP_END = "// END LOCAL TO CLOUD TUNNEL FIX";
const LEGACY_HT_BEGIN = "# BEGIN LOCAL TO CLOUD WP-ADMIN FIX";
const LEGACY_HT_END = "# END LOCAL TO CLOUD WP-ADMIN FIX";
const MU_PLUGIN_RELATIVE_PATH = path.join("wp-content", "mu-plugins", "cooltunnel.php");
const LEGACY_MU_PLUGIN_RELATIVE_PATH = path.join("wp-content", "mu-plugins", "local-to-cloud-tunnel.php");
const MU_PLUGIN_MARKER = "COOLTUNNEL MANAGED MU PLUGIN";
const LEGACY_MU_PLUGIN_MARKER = "LOCAL TO CLOUD MANAGED MU PLUGIN";

export function createWordPressBlock(pathname = ""): string {
  const publicPath = normalizePathname(pathname).replace(/'/g, "\\'");
  return `${WP_BEGIN}
$cooltunnel_forwarded_host = !empty($_SERVER['HTTP_X_FORWARDED_HOST'])
    ? $_SERVER['HTTP_X_FORWARDED_HOST']
    : (!empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '');
if ($cooltunnel_forwarded_host &&
    (!empty($_SERVER['HTTP_X_COOLTUNNEL_PROXY']) || !empty($_SERVER['HTTP_X_LOCAL_TO_CLOUD_PROXY']))) {
    $cooltunnel_host = trim(explode(',', $cooltunnel_forwarded_host)[0]);
    $cooltunnel_host = preg_replace('/:\\d+$/', '', $cooltunnel_host);
    $cooltunnel_path = '${publicPath}';

    if (preg_match('/^[a-z0-9-]+\\.trycloudflare\\.com$/i', $cooltunnel_host)) {
        $_SERVER['HTTP_X_FORWARDED_HOST'] = $cooltunnel_host;
        $_SERVER['HTTP_X_FORWARDED_PROTO'] = 'https';
        $_SERVER['HTTPS'] = 'on';
        $_SERVER['HTTP_HOST'] = $cooltunnel_host;
        $_SERVER['SERVER_NAME'] = $cooltunnel_host;
        $_SERVER['SERVER_PORT'] = 443;

        if (!defined('FORCE_SSL_ADMIN')) {
            define('FORCE_SSL_ADMIN', true);
        }

        if (!defined('COOKIE_DOMAIN')) {
            define('COOKIE_DOMAIN', false);
        }
    }
}
${WP_END}`;
}

function phpString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function createMustUsePlugin(localUrl = "http://localhost", pathname = ""): string {
  const parsed = parseLocalUrl(localUrl);
  const publicPath = normalizePathname(pathname || parsed.pathname);
  const localPath = normalizePathname(parsed.pathname);
  const explicitOrigin = `${parsed.protocol}://${parsed.hostHeader}${localPath}`;
  const localOrigins = [...new Set([
    explicitOrigin,
    `${parsed.protocol}://${parsed.host}${localPath}`,
    `${parsed.protocol}://${parsed.hostHeader}`,
    `${parsed.protocol}://${parsed.host}`,
    `http://${parsed.hostHeader}`,
    `https://${parsed.hostHeader}`
  ])].sort((a, b) => b.length - a.length);
  const phpOrigins = localOrigins.map((origin) => `    '${phpString(origin)}'`).join(",\n");
  return `<?php
/**
 * ${MU_PLUGIN_MARKER}
 * Dynamically maps local-site URLs to the active Cloudflare Quick Tunnel.
 */

if (!defined('ABSPATH')) {
    exit;
}

function cooltunnel_public_base() {
    $forwarded = !empty($_SERVER['HTTP_X_FORWARDED_HOST'])
        ? $_SERVER['HTTP_X_FORWARDED_HOST']
        : (!empty($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '');
    $host = preg_replace('/:\\d+$/', '', trim(explode(',', $forwarded)[0]));
    if ((empty($_SERVER['HTTP_X_COOLTUNNEL_PROXY']) && empty($_SERVER['HTTP_X_LOCAL_TO_CLOUD_PROXY'])) ||
        !preg_match('/^[a-z0-9-]+\\.trycloudflare\\.com$/i', $host)) {
        return false;
    }
    return 'https://' . $host . '${phpString(publicPath)}';
}

function cooltunnel_replace_url($value) {
    $public = cooltunnel_public_base();
    if (!$public || !is_string($value)) {
        return $value;
    }
    $local_origins = array(
${phpOrigins}
    );
    foreach ($local_origins as $origin) {
        $value = str_ireplace(rtrim($origin, '/'), $public, $value);
    }
    return $value;
}

function cooltunnel_option_url($value = false) {
    $public = cooltunnel_public_base();
    return $public ?: $value;
}

function cooltunnel_upload_dir($uploads) {
    if (!is_array($uploads)) {
        return $uploads;
    }
    foreach (array('url', 'baseurl') as $key) {
        if (isset($uploads[$key])) {
            $uploads[$key] = cooltunnel_replace_url($uploads[$key]);
        }
    }
    return $uploads;
}

add_filter('pre_option_home', 'cooltunnel_option_url', 9999);
add_filter('pre_option_siteurl', 'cooltunnel_option_url', 9999);
add_filter('option_home', 'cooltunnel_replace_url', 9999);
add_filter('option_siteurl', 'cooltunnel_replace_url', 9999);
foreach (array(
    'home_url', 'site_url', 'admin_url', 'network_home_url', 'network_site_url',
    'includes_url', 'content_url', 'plugins_url', 'theme_file_uri',
    'wp_get_attachment_url', 'wp_redirect', 'login_url', 'logout_url',
    'register_url', 'rest_url'
) as $cooltunnel_filter) {
    add_filter($cooltunnel_filter, 'cooltunnel_replace_url', 9999);
}
add_filter('upload_dir', 'cooltunnel_upload_dir', 9999);
add_filter('allowed_redirect_hosts', function ($hosts) {
    $public = cooltunnel_public_base();
    if ($public) {
        $hosts[] = wp_parse_url($public, PHP_URL_HOST);
    }
    return array_values(array_unique($hosts));
}, 9999);
`;
}

function escapeApacheRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createHtaccessBlock(pathname = ""): string {
  const publicPath = normalizePathname(pathname);
  const adminPath = `${publicPath}/wp-admin`;
  const adminPathRegex = escapeApacheRegex(adminPath);
  return `${HT_BEGIN}
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_URI} ^${adminPathRegex}$ [NC]
RewriteCond %{HTTP:X-Forwarded-Host} ^([a-z0-9-]+\\.trycloudflare\\.com)$ [NC]
RewriteRule ^ https://%1${adminPath}/ [R=302,L]
</IfModule>
${HT_END}`;
}

export const WORDPRESS_BLOCK = createWordPressBlock();
export const HTACCESS_BLOCK = createHtaccessBlock();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markedBlockRegex(begin: string, end: string): RegExp {
  return new RegExp(`${escapeRegex(begin)}[\\s\\S]*?${escapeRegex(end)}\\s*`, "g");
}

function lineEndingOf(content: string): "\r\n" | "\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function withLineEndings(content: string, eol: string): string {
  return content.replace(/\r?\n/g, eol);
}

export function upsertMarkedBlock(
  content: string,
  block: string,
  begin: string,
  end: string,
  anchor: RegExp,
  fallbackAfterPhp = false
): string {
  const eol = lineEndingOf(content);
  const normalizedBlock = withLineEndings(block, eol);
  const existing = markedBlockRegex(begin, end);
  if (existing.test(content)) {
    return content.replace(markedBlockRegex(begin, end), `${normalizedBlock}${eol}${eol}`);
  }
  const anchorMatch = content.match(anchor);
  if (anchorMatch?.index !== undefined) {
    return `${content.slice(0, anchorMatch.index)}${normalizedBlock}${eol}${eol}${content.slice(anchorMatch.index)}`;
  }
  if (fallbackAfterPhp) {
    const phpMatch = content.match(/<\?php\s*/);
    if (phpMatch?.index !== undefined) {
      const insertAt = phpMatch.index + phpMatch[0].length;
      return `${content.slice(0, insertAt)}${eol}${normalizedBlock}${eol}${eol}${content.slice(insertAt)}`;
    }
  }
  return `${normalizedBlock}${eol}${eol}${content}`;
}

export function removeMarkedBlock(content: string, begin: string, end: string): string {
  return content.replace(markedBlockRegex(begin, end), "");
}

export function upsertPhpBootstrap(content: string, block: string): string {
  const cleaned = removeMarkedBlock(
    removeMarkedBlock(content, WP_BEGIN, WP_END),
    LEGACY_WP_BEGIN,
    LEGACY_WP_END
  );
  const eol = lineEndingOf(cleaned);
  const normalizedBlock = withLineEndings(block, eol);
  const phpMatch = cleaned.match(/<\?php[^\S\r\n]*/);
  if (!phpMatch?.index && phpMatch?.index !== 0) {
    return `${normalizedBlock}${eol}${eol}${cleaned}`;
  }
  const insertAt = phpMatch.index + phpMatch[0].length;
  const remainder = cleaned.slice(insertAt).replace(/^\r?\n?/, "");
  return `${cleaned.slice(0, insertAt)}${eol}${normalizedBlock}${eol}${eol}${remainder}`;
}

export class WordPressService {
  private sessionApplied = new Set<string>();
  private scanCache = new Map<string, { expires: number; sites: WordPressSite[] }>();

  async isValid(folder: string): Promise<boolean> {
    try {
      const resolved = path.resolve(folder);
      const required = ["wp-config.php", "wp-admin", "wp-content", "wp-includes"];
      const stats = await Promise.all(required.map((name) => fs.stat(path.join(resolved, name))));
      return stats[0].isFile() && stats.slice(1).every((stat) => stat.isDirectory());
    } catch {
      return false;
    }
  }

  async scan(scanFolders: string[], host?: string): Promise<WordPressSite[]> {
    const cacheKey = JSON.stringify([scanFolders.map((folder) => path.resolve(folder)), host ?? ""]);
    const cached = this.scanCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.sites.map((site) => ({ ...site }));
    const sites = new Map<string, WordPressSite>();
    const guessedName = host?.replace(/[^a-z0-9_-]/gi, "");

    for (const root of scanFolders) {
      const configuredRoot = await this.resolveWordPressRoot(root, "scan");
      if (configuredRoot) this.addSite(sites, configuredRoot);

      if (guessedName) {
        const guessed = await this.resolveWordPressRoot(path.join(root, guessedName), "guessed");
        if (guessed) this.addSite(sites, guessed);
      }
      try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        for (const entry of entries.filter((item) => item.isDirectory())) {
          const folder = path.join(root, entry.name);
          const site = await this.resolveWordPressRoot(folder, "scan");
          if (site) this.addSite(sites, site);
        }
      } catch {
        // Missing common roots are expected.
      }
    }
    const result = [...sites.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.scanCache.set(cacheKey, { expires: Date.now() + 30_000, sites: result });
    return result;
  }

  async resolveWordPressRoot(
    selectedFolder: string,
    directSource: WordPressSite["source"] = "manual"
  ): Promise<WordPressSite | null> {
    const selected = path.resolve(selectedFolder);
    if (await this.isValid(selected)) {
      const isLocalWpPublic = path.basename(selected).toLowerCase() === "public"
        && path.basename(path.dirname(selected)).toLowerCase() === "app";
      return {
        path: selected,
        name: isLocalWpPublic ? path.basename(path.dirname(path.dirname(selected))) : path.basename(selected),
        source: isLocalWpPublic ? "localwp" : directSource
      };
    }

    const candidates = path.basename(selected).toLowerCase() === "app"
      ? [path.join(selected, "public")]
      : [path.join(selected, "app", "public")];
    for (const candidate of candidates) {
      if (await this.isValid(candidate)) {
        return {
          path: path.resolve(candidate),
          name: path.basename(selected).toLowerCase() === "app"
            ? path.basename(path.dirname(selected))
            : path.basename(selected),
          source: "localwp"
        };
      }
    }
    return null;
  }

  async apply(
    folder: string,
    fixHtaccess: boolean,
    pathname = "",
    localUrl = "http://localhost"
  ): Promise<WordPressEditResult[]> {
    await this.assertValidFolder(folder);
    const results = [
      await this.editFile(folder, "wp-config.php", (content) =>
        upsertPhpBootstrap(content, createWordPressBlock(pathname)),
      "Applied early WordPress tunnel bootstrap"),
      await this.writeManagedPlugin(folder, createMustUsePlugin(localUrl, pathname))
    ];
    const legacyPluginResult = await this.removeLegacyManagedPlugin(folder);
    if (legacyPluginResult) results.push(legacyPluginResult);
    if (fixHtaccess) {
      results.push(await this.editFile(folder, ".htaccess", (content) =>
        upsertMarkedBlock(
          removeMarkedBlock(content, LEGACY_HT_BEGIN, LEGACY_HT_END),
          createHtaccessBlock(pathname),
          HT_BEGIN,
          HT_END,
          /^# BEGIN WordPress\s*$/im
        ),
      "Applied wp-admin redirect fix", true));
    }
    this.sessionApplied.add(path.resolve(folder));
    return results;
  }

  private addSite(sites: Map<string, WordPressSite>, site: WordPressSite): void {
    const key = path.resolve(site.path).toLowerCase();
    const existing = sites.get(key);
    if (!existing || site.source === "guessed") sites.set(key, site);
  }

  async remove(folder: string, removeHtaccess: boolean): Promise<WordPressEditResult[]> {
    await this.assertValidFolder(folder);
    const results = [
      await this.editFile(folder, "wp-config.php", (content) =>
        removeMarkedBlock(
          removeMarkedBlock(content, WP_BEGIN, WP_END),
          LEGACY_WP_BEGIN,
          LEGACY_WP_END
        ),
      "Removed WordPress tunnel bootstrap"),
      await this.removeManagedPlugin(folder)
    ];
    const legacyPluginResult = await this.removeLegacyManagedPlugin(folder);
    if (legacyPluginResult) results.push(legacyPluginResult);
    if (removeHtaccess) {
      results.push(await this.editFile(folder, ".htaccess", (content) =>
        removeMarkedBlock(
          removeMarkedBlock(content, HT_BEGIN, HT_END),
          LEGACY_HT_BEGIN,
          LEGACY_HT_END
        ),
      "Removed wp-admin redirect fix", true));
    }
    this.sessionApplied.delete(path.resolve(folder));
    return results;
  }

  getSessionApplied(): string[] {
    return [...this.sessionApplied];
  }

  async removeSessionFixes(): Promise<WordPressEditResult[]> {
    const results: WordPressEditResult[] = [];
    for (const folder of [...this.sessionApplied]) {
      results.push(...await this.remove(folder, true));
    }
    return results;
  }

  private async assertValidFolder(folder: string): Promise<void> {
    if (!folder || !(await this.isValid(folder))) {
      throw new Error("The selected folder is not a valid WordPress installation.");
    }
  }

  private async editFile(
    folder: string,
    fileName: "wp-config.php" | ".htaccess",
    transform: (content: string) => string,
    message: string,
    allowMissing = false
  ): Promise<WordPressEditResult> {
    const root = path.resolve(folder);
    const filePath = path.resolve(root, fileName);
    if (path.dirname(filePath) !== root) throw new Error("Refusing to edit outside the selected WordPress folder.");

    let content = "";
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (!allowMissing) throw error;
    }
    const next = transform(content);
    if (next === content) return { success: true, path: filePath, message: `${message}; no changes were needed.` };

    const backupPath = `${filePath}.backup-${this.timestamp()}`;
    await fs.writeFile(backupPath, content, "utf8");
    await fs.writeFile(filePath, next, "utf8");
    return { success: true, path: filePath, backupPath, message };
  }

  async checkCompatibility(publicUrl: string, localUrl: string): Promise<CompatibilityReport> {
    if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com(?:\/|$)/i.test(publicUrl)) {
      throw new Error("Compatibility checks are limited to Cloudflare Quick Tunnel URLs.");
    }
    const parsed = parseLocalUrl(localUrl);
    try {
      const response = await fetch(publicUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "Local-to-Cloud/1.2.1 compatibility-check" }
      });
      const location = response.headers.get("location");
      const localCandidates = [...new Set([
        parsed.hostHeader,
        parsed.host,
        `${parsed.protocol}://${parsed.hostHeader}`,
        `http://${parsed.hostHeader}`,
        `https://${parsed.hostHeader}`
      ])].filter(Boolean);
      if (location && localCandidates.some((candidate) => location.toLowerCase().includes(candidate.toLowerCase()))) {
        return {
          status: "fix-required",
          checkedUrl: publicUrl,
          localReferences: [location],
          message: `The public site redirects to the local address: ${location}`
        };
      }
      if (response.status >= 300 && response.status < 400 && location) {
        return {
          status: "error",
          checkedUrl: publicUrl,
          localReferences: [],
          message: `The public site returned an unexpected redirect to ${location}.`
        };
      }
      const html = await response.text();
      const localReferences = localCandidates.filter((candidate) =>
        html.toLowerCase().includes(candidate.toLowerCase())
      );
      if (localReferences.length) {
        return {
          status: "fix-required",
          checkedUrl: response.url,
          localReferences,
          message: "The page still contains local-domain links. Apply or refresh the WordPress tunnel fix."
        };
      }
      return {
        status: response.ok ? "compatible" : "error",
        checkedUrl: response.url,
        localReferences: [],
        message: response.ok
          ? "No local-domain links were detected on the public homepage."
          : `The public site returned HTTP ${response.status}.`
      };
    } catch (error) {
      return {
        status: "error",
        checkedUrl: publicUrl,
        localReferences: [],
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private managedPluginPath(folder: string): string {
    const root = path.resolve(folder);
    const pluginPath = path.resolve(root, MU_PLUGIN_RELATIVE_PATH);
    if (!pluginPath.startsWith(`${root}${path.sep}`)) {
      throw new Error("Refusing to edit outside the selected WordPress folder.");
    }
    return pluginPath;
  }

  private legacyManagedPluginPath(folder: string): string {
    const root = path.resolve(folder);
    const pluginPath = path.resolve(root, LEGACY_MU_PLUGIN_RELATIVE_PATH);
    if (!pluginPath.startsWith(`${root}${path.sep}`)) {
      throw new Error("Refusing to edit outside the selected WordPress folder.");
    }
    return pluginPath;
  }

  private async writeManagedPlugin(folder: string, content: string): Promise<WordPressEditResult> {
    const pluginPath = this.managedPluginPath(folder);
    await fs.mkdir(path.dirname(pluginPath), { recursive: true });
    let current = "";
    try {
      current = await fs.readFile(pluginPath, "utf8");
      if (current && !current.includes(MU_PLUGIN_MARKER)) {
        throw new Error(`A non-managed file already exists at ${MU_PLUGIN_RELATIVE_PATH}.`);
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
    if (current === content) {
      return { success: true, path: pluginPath, message: "Applied WordPress URL bridge; no changes were needed." };
    }
    const backupPath = current ? `${pluginPath}.backup-${this.timestamp()}` : undefined;
    if (backupPath) await fs.writeFile(backupPath, current, "utf8");
    await fs.writeFile(pluginPath, content, "utf8");
    return {
      success: true,
      path: pluginPath,
      ...(backupPath ? { backupPath } : {}),
      message: "Applied WordPress URL bridge"
    };
  }

  private async removeManagedPlugin(folder: string): Promise<WordPressEditResult> {
    const pluginPath = this.managedPluginPath(folder);
    try {
      const current = await fs.readFile(pluginPath, "utf8");
      if (!current.includes(MU_PLUGIN_MARKER)) {
        throw new Error(`Refusing to remove the non-managed file at ${MU_PLUGIN_RELATIVE_PATH}.`);
      }
      const backupPath = `${pluginPath}.backup-${this.timestamp()}`;
      await fs.writeFile(backupPath, current, "utf8");
      await fs.unlink(pluginPath);
      return { success: true, path: pluginPath, backupPath, message: "Removed WordPress URL bridge" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: true, path: pluginPath, message: "Removed WordPress URL bridge; no changes were needed." };
      }
      throw error;
    }
  }

  private async removeLegacyManagedPlugin(folder: string): Promise<WordPressEditResult | null> {
    const pluginPath = this.legacyManagedPluginPath(folder);
    try {
      const current = await fs.readFile(pluginPath, "utf8");
      if (!current.includes(LEGACY_MU_PLUGIN_MARKER)) {
        throw new Error(`Refusing to remove the non-managed file at ${LEGACY_MU_PLUGIN_RELATIVE_PATH}.`);
      }
      const backupPath = `${pluginPath}.backup-${this.timestamp()}`;
      await fs.writeFile(backupPath, current, "utf8");
      await fs.unlink(pluginPath);
      return { success: true, path: pluginPath, backupPath, message: "Migrated legacy WordPress URL bridge" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private timestamp(): string {
    const date = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  }
}
