import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "website", "cooltunnel");
const htmlFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.name.endsWith(".html")) htmlFiles.push(fullPath);
  }
}

function resolveLocalReference(file, reference) {
  const clean = reference.split("#")[0].split("?")[0];
  if (!clean) return null;
  if (clean.startsWith("/cooltunnel/")) {
    return path.join(root, clean.slice("/cooltunnel/".length));
  }
  if (clean.startsWith("/")) return null;
  return path.resolve(path.dirname(file), clean);
}

async function assertTarget(target, reference, file) {
  let candidate = target;
  if (reference.endsWith("/") || path.extname(candidate) === "") {
    candidate = path.join(candidate, "index.html");
  }
  try {
    await access(candidate);
  } catch {
    throw new Error(`Broken local link in ${path.relative(root, file)}: ${reference}`);
  }
}

await walk(root);
if (htmlFiles.length < 7) throw new Error("Expected all CoolTunnel product pages.");

const requiredRoutes = [
  "index.html",
  "docs/index.html",
  "support/index.html",
  "privacy/index.html",
  "license/index.html",
  "third-party-notices/index.html",
  "release-notes/index.html"
];
await Promise.all(requiredRoutes.map((file) => access(path.join(root, file))));
await access(path.join(root, ".htaccess"));

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (!html.includes("CoolTunnel")) {
    throw new Error(`${path.relative(root, file)} is missing CoolTunnel branding.`);
  }
  const references = [...html.matchAll(/\b(?:href|src)=["']([^"'#]+(?:#[^"']*)?)["']/g)]
    .map((match) => match[1])
    .filter((reference) =>
      !reference.startsWith("https://")
      && !reference.startsWith("http://")
      && !reference.startsWith("mailto:")
      && !reference.startsWith("data:")
    );
  for (const reference of references) {
    const target = resolveLocalReference(file, reference);
    if (target) await assertTarget(target, reference.split("#")[0], file);
  }
}

const siteText = (await Promise.all(htmlFiles.map((file) => readFile(file, "utf8")))).join("\n");
const forbiddenLinks = [
  "coolplugins.net/support/",
  "my.coolplugins.net/privacy-policy/",
  "coolplugins.net/docs/cooltunnel/",
  "github.com/coolplugins/cooltunnel"
];
for (const forbidden of forbiddenLinks) {
  if (siteText.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`Website still contains legacy or shared-service link: ${forbidden}`);
  }
}

console.log(`CoolTunnel website validation passed: ${htmlFiles.length} pages.`);
