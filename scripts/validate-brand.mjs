import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const brand = JSON.parse(await readFile(path.join(root, "brand.config.json"), "utf8"));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const assertions = [
  [packageJson.name === brand.packageName, "package name"],
  [packageJson.productName === brand.productName, "product name"],
  [packageJson.version === "2.0.0", "release version"],
  [packageJson.companyName === brand.publisher, "publisher"],
  [packageJson.author === brand.publisher, "Windows company metadata"],
  [packageJson.copyright === brand.copyright, "copyright"],
  [packageJson.homepage === brand.urls.product, "homepage"],
  [packageJson.license === brand.license, "license"],
  [brand.urls.documentation === "https://coolplugins.net/cooltunnel/docs/", "documentation URL"],
  [brand.urls.support === "https://coolplugins.net/cooltunnel/support/", "support URL"],
  [brand.urls.privacy === "https://coolplugins.net/cooltunnel/privacy/", "privacy URL"],
  [brand.urls.source === "https://github.com/CoolPluginsTeam/cooltunnel", "source URL"]
];
for (const [passed, label] of assertions) {
  if (!passed) throw new Error(`Brand validation failed for ${label}.`);
}

await Promise.all([
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  brand.assets.icon,
  brand.assets.horizontalLogo,
  brand.assets.stackedLogo,
  brand.assets.monochromeLogo,
  brand.assets.socialPreview,
  "build/icon.ico",
  "build/website/cooltunnel-social-preview.png",
  "website/cooltunnel/index.html"
].map((file) => access(path.join(root, file))));

const renderer = await readFile(path.join(root, "dist", "index.html"), "utf8");
if (renderer.includes("Local to Cloud")) {
  throw new Error("Renderer output still contains the legacy product name.");
}

console.log(`${brand.productName} brand validation passed.`);
