import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";

const root = process.cwd();
const brand = JSON.parse(await readFile(path.join(root, "brand.config.json"), "utf8"));
const source = path.join(root, brand.assets.icon);
const output = path.join(root, "build");
await mkdir(output, { recursive: true });
const websiteOutput = path.join(output, "website");
await mkdir(websiteOutput, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const pngs = [];
for (const size of sizes) {
  const target = path.join(output, `icon-${size}.png`);
  await sharp(source).resize(size, size).png().toFile(target);
  if (size <= 256) pngs.push(target);
}
await sharp(source).resize(512, 512).png().toFile(path.join(output, "icon.png"));
await sharp(source).resize(64, 64).png().toFile(path.join(output, "favicon.png"));
await sharp(path.join(root, brand.assets.socialPreview)).png().toFile(path.join(output, "social-preview.png"));
await sharp(path.join(root, brand.assets.horizontalLogo)).png().toFile(path.join(output, "logo-horizontal.png"));
await writeFile(path.join(output, "icon.ico"), await pngToIco(pngs));
await copyFile(path.join(output, "icon-256.png"), path.join(websiteOutput, "cooltunnel-icon.png"));
await copyFile(path.join(output, "favicon.png"), path.join(websiteOutput, "favicon.png"));
await copyFile(path.join(output, "social-preview.png"), path.join(websiteOutput, "cooltunnel-social-preview.png"));
await copyFile(path.join(output, "logo-horizontal.png"), path.join(websiteOutput, "cooltunnel-logo-horizontal.png"));
console.log(`Generated ${brand.productName} application and web assets.`);
