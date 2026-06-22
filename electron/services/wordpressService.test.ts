import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HTACCESS_BLOCK,
  WORDPRESS_BLOCK,
  WordPressService,
  createHtaccessBlock,
  createMustUsePlugin,
  createWordPressBlock,
  removeMarkedBlock,
  upsertMarkedBlock
} from "./wordpressService";

const WP_BEGIN = "// BEGIN COOLTUNNEL WORDPRESS FIX";
const WP_END = "// END COOLTUNNEL WORDPRESS FIX";
const HT_BEGIN = "# BEGIN COOLTUNNEL WP-ADMIN FIX";
const HT_END = "# END COOLTUNNEL WP-ADMIN FIX";
let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "local-to-cloud-"));
  await Promise.all(["wp-admin", "wp-content", "wp-includes"].map((name) =>
    fs.mkdir(path.join(root, name))
  ));
  await fs.writeFile(
    path.join(root, "wp-config.php"),
    "<?php\r\n// custom settings\r\n/* That's all, stop editing! Happy publishing. */\r\n",
    "utf8"
  );
  await fs.writeFile(path.join(root, ".htaccess"), "# BEGIN WordPress\nRules\n", "utf8");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("marked block transforms", () => {
  it("inserts and replaces only the WordPress block", () => {
    const original = "<?php\n$keep = true;\n/* That's all, stop editing! Happy publishing. */\n";
    const inserted = upsertMarkedBlock(
      original,
      WORDPRESS_BLOCK,
      WP_BEGIN,
      WP_END,
      /\/\*\s*That's all,\s*stop editing!\s*Happy publishing\.\s*\*\//i,
      true
    );
    expect(inserted.indexOf(WP_BEGIN)).toBeLessThan(inserted.indexOf("That's all"));
    expect(inserted).toContain("$keep = true;");

    const replaced = upsertMarkedBlock(
      inserted.replace("if (!empty", "if (false && !empty"),
      WORDPRESS_BLOCK,
      WP_BEGIN,
      WP_END,
      /not-used/,
      true
    );
    expect(replaced).not.toContain("if (false");
    expect(replaced.match(new RegExp(WP_BEGIN, "g"))).toHaveLength(1);
  });

  it("removes only the marked content", () => {
    const source = `before\n${HTACCESS_BLOCK}\nafter\n`;
    expect(removeMarkedBlock(source, HT_BEGIN, HT_END)).toBe("before\nafter\n");
  });

  it("generates path-aware WordPress and wp-admin fixes", () => {
    const config = createWordPressBlock("/sitename/");
    const htaccess = createHtaccessBlock("/sitename/");
    expect(config).toContain("$cooltunnel_path = '/sitename';");
    expect(config).toContain("HTTP_X_FORWARDED_PROTO");
    const plugin = createMustUsePlugin("localhost:10005", "/sitename/");
    expect(plugin).toContain("'http://localhost:10005'");
    expect(plugin).toContain("return 'https://' . $host . '/sitename';");
    expect(plugin).toContain("add_filter('pre_option_home'");
    expect(plugin).toContain("'wp_redirect'");
    const subfolderPlugin = createMustUsePlugin("localhost/sitename", "/sitename");
    expect(subfolderPlugin.indexOf("'http://localhost/sitename'"))
      .toBeLessThan(subfolderPlugin.indexOf("'http://localhost'"));
    expect(htaccess).toContain("^/sitename/wp-admin$");
    expect(htaccess).toContain("https://%1/sitename/wp-admin/");
  });

  it("keeps root-site fix behavior unchanged", () => {
    expect(createWordPressBlock()).toContain("$cooltunnel_path = '';");
    expect(createHtaccessBlock()).toContain("^/wp-admin$");
    expect(createHtaccessBlock()).toContain("https://%1/wp-admin/");
  });
});

describe("WordPress file safety", () => {
  it("creates backups and applies both fixes", async () => {
    const service = new WordPressService();
    const results = await service.apply(root, true);
    expect(results).toHaveLength(3);
    for (const result of results.filter((result) => result.backupPath)) {
      expect(result.backupPath).toBeTruthy();
      await expect(fs.stat(result.backupPath!)).resolves.toBeTruthy();
    }
    expect(await fs.readFile(path.join(root, "wp-config.php"), "utf8")).toContain(WP_BEGIN);
    expect(await fs.readFile(path.join(root, ".htaccess"), "utf8")).toContain(HT_BEGIN);
    expect(await fs.readFile(
      path.join(root, "wp-content", "mu-plugins", "cooltunnel.php"),
      "utf8"
    )).toContain("COOLTUNNEL MANAGED MU PLUGIN");
  });

  it("removes only managed blocks and keeps surrounding content", async () => {
    const service = new WordPressService();
    await service.apply(root, true);
    await service.remove(root, true);
    const config = await fs.readFile(path.join(root, "wp-config.php"), "utf8");
    const htaccess = await fs.readFile(path.join(root, ".htaccess"), "utf8");
    expect(config).not.toContain(WP_BEGIN);
    expect(config).toContain("// custom settings");
    expect(htaccess).not.toContain(HT_BEGIN);
    expect(htaccess).toContain("# BEGIN WordPress");
  });

  it("uses the PHP opening tag when the normal anchor is missing", async () => {
    await fs.writeFile(path.join(root, "wp-config.php"), "<?php\n$custom = 1;\n", "utf8");
    const service = new WordPressService();
    await service.apply(root, false);
    const config = await fs.readFile(path.join(root, "wp-config.php"), "utf8");
    expect(config.indexOf(WP_BEGIN)).toBeLessThan(config.indexOf("$custom"));
  });

  it("places the bootstrap before existing LocalWP URL constants", async () => {
    await fs.writeFile(
      path.join(root, "wp-config.php"),
      "<?php\ndefine('WP_HOME', 'http://localhost:10005');\ndefine('WP_SITEURL', 'http://localhost:10005');\n",
      "utf8"
    );
    const service = new WordPressService();
    await service.apply(root, false, "", "localhost:10005");
    const config = await fs.readFile(path.join(root, "wp-config.php"), "utf8");
    expect(config.indexOf(WP_BEGIN)).toBeLessThan(config.indexOf("define('WP_HOME'"));
  });

  it("migrates legacy managed blocks and the legacy must-use plugin", async () => {
    const legacyPlugin = path.join(root, "wp-content", "mu-plugins", "local-to-cloud-tunnel.php");
    await fs.mkdir(path.dirname(legacyPlugin), { recursive: true });
    await fs.writeFile(legacyPlugin, "<?php\n/** LOCAL TO CLOUD MANAGED MU PLUGIN */\n", "utf8");
    await fs.writeFile(
      path.join(root, "wp-config.php"),
      "<?php\n// BEGIN LOCAL TO CLOUD TUNNEL FIX\nlegacy\n// END LOCAL TO CLOUD TUNNEL FIX\n",
      "utf8"
    );
    const service = new WordPressService();
    await service.apply(root, false, "", "http://example.local");
    const config = await fs.readFile(path.join(root, "wp-config.php"), "utf8");
    expect(config).toContain(WP_BEGIN);
    expect(config).not.toContain("BEGIN LOCAL TO CLOUD");
    await expect(fs.stat(legacyPlugin)).rejects.toThrow();
    await expect(fs.stat(path.join(root, "wp-content", "mu-plugins", "cooltunnel.php"))).resolves.toBeTruthy();
  });

  it("rejects folders that are not WordPress installations", async () => {
    const service = new WordPressService();
    const invalid = await fs.mkdtemp(path.join(os.tmpdir(), "not-wordpress-"));
    await expect(service.apply(invalid, false)).rejects.toThrow(/not a valid WordPress/);
    await fs.rm(invalid, { recursive: true, force: true });
  });

  it("detects LocalWP site/app/public layouts", async () => {
    const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-sites-"));
    const publicRoot = path.join(localRoot, "My Local Site", "app", "public");
    await Promise.all(["wp-admin", "wp-content", "wp-includes"].map((name) =>
      fs.mkdir(path.join(publicRoot, name), { recursive: true })
    ));
    await fs.writeFile(path.join(publicRoot, "wp-config.php"), "<?php\n", "utf8");

    const service = new WordPressService();
    const sites = await service.scan([localRoot], "MyLocalSite");
    expect(sites).toContainEqual({
      path: path.resolve(publicRoot),
      name: "My Local Site",
      source: "localwp"
    });
    await fs.rm(localRoot, { recursive: true, force: true });
  });

  it("resolves manual LocalWP site, app, and public selections", async () => {
    const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), "local-manual-"));
    const siteRoot = path.join(localRoot, "Demo Site");
    const appRoot = path.join(siteRoot, "app");
    const publicRoot = path.join(appRoot, "public");
    await Promise.all(["wp-admin", "wp-content", "wp-includes"].map((name) =>
      fs.mkdir(path.join(publicRoot, name), { recursive: true })
    ));
    await fs.writeFile(path.join(publicRoot, "wp-config.php"), "<?php\n", "utf8");

    const service = new WordPressService();
    for (const selected of [siteRoot, appRoot, publicRoot]) {
      await expect(service.resolveWordPressRoot(selected)).resolves.toEqual({
        path: path.resolve(publicRoot),
        name: "Demo Site",
        source: "localwp"
      });
    }
    await fs.rm(localRoot, { recursive: true, force: true });
  });
});
