import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "dist", "index.html");
const html = await readFile(indexPath, "utf8");

if (/=["']\/assets\//.test(html)) {
  throw new Error("Renderer build contains absolute /assets paths and will be blank under Electron file://.");
}

const assetPaths = [...html.matchAll(/(?:src|href)=["'](\.\/assets\/[^"']+)["']/g)]
  .map((match) => match[1]);

if (!assetPaths.length) {
  throw new Error("Renderer build does not reference any relative assets.");
}

await Promise.all(assetPaths.map((asset) => access(path.join(root, "dist", asset.slice(2)))));
await access(path.join(root, "dist-electron", "electron", "main.js"));
await access(path.join(root, "dist-electron", "electron", "preload.js"));
await access(path.join(root, "resources", "bin", process.platform === "win32" ? "cloudflared.exe" : "cloudflared"));
await access(path.join(root, "build", "icon.ico"));
await access(path.join(root, "build", "icon.png"));

console.log("Build verification passed: renderer assets, Electron entry points, branding, and cloudflared are present.");
