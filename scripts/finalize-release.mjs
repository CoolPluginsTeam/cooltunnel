import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const release = path.join(
  process.cwd(),
  process.env.COOLTUNNEL_OUTPUT_DIR || "release"
);
const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
const brand = JSON.parse(await readFile(path.join(process.cwd(), "brand.config.json"), "utf8"));
const files = await readdir(release);
const installer = `${brand.releaseArtifactName}-${packageJson.version}.exe`;
if (!installer) throw new Error("Windows installer is missing.");
if (!files.includes(installer)) throw new Error(`Expected installer is missing: ${installer}`);
await access(path.join(release, "win-unpacked", "resources", "bin", "cloudflared.exe"));

const bytes = await readFile(path.join(release, installer));
const hash = createHash("sha256").update(bytes).digest("hex").toUpperCase();
const sha512 = createHash("sha512").update(bytes).digest("base64");
const checksumFile = `${installer}.sha256`;
await writeFile(path.join(release, checksumFile), `${hash}  ${installer}\n`, "utf8");

const latestPath = path.join(release, "latest.yml");
if (process.env.REQUIRE_UPDATE_METADATA === "true") {
  const latest = await readFile(latestPath, "utf8");
  if (!latest.includes(installer)) throw new Error("latest.yml does not reference the generated installer.");
} else {
  const escapedInstaller = installer.replace(/"/g, '\\"');
  await writeFile(latestPath, [
    `version: ${packageJson.version}`,
    "files:",
    `  - url: "${escapedInstaller}"`,
    `    sha512: ${sha512}`,
    `    size: ${bytes.length}`,
    `path: "${escapedInstaller}"`,
    `sha512: ${sha512}`,
    `releaseDate: ${new Date().toISOString()}`,
    ""
  ].join("\n"), "utf8");
}

const stagingPercentage = Number(process.env.STAGING_PERCENTAGE || "10");
if (Number.isFinite(stagingPercentage) && stagingPercentage > 0 && stagingPercentage < 100) {
  const latest = await readFile(latestPath, "utf8");
  if (!/\bstagingPercentage:/.test(latest)) {
    await writeFile(latestPath, `${latest.trimEnd()}\nstagingPercentage: ${stagingPercentage}\n`, "utf8");
  }
}

if (process.env.REQUIRE_SIGNING === "true") {
  const targets = [
    path.join(release, installer),
    path.join(release, "win-unpacked", `${brand.executableName}.exe`)
  ];
  for (const target of targets) {
    const script = [
      `$signature = Get-AuthenticodeSignature -LiteralPath '${target.replaceAll("'", "''")}'`,
      `if ($signature.Status -ne 'Valid') { throw 'Invalid signature: ' + $signature.Status }`,
      `$subject = $signature.SignerCertificate.Subject`,
      `if ($subject -notlike '*${brand.publisher.replaceAll("'", "''")}*') { throw 'Publisher mismatch: ' + $subject }`
    ].join("; ");
    const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Signature verification failed for ${path.basename(target)}: ${result.stderr || result.stdout}`);
  }
}
console.log(`Release verification passed: ${installer}\nSHA-256 ${hash}`);
