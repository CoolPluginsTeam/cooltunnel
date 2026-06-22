const path = require("node:path");
const brand = require("./brand.config.json");

const owner = process.env.GH_OWNER || process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GH_REPO;
const publish = owner && repo ? [{ provider: "github", owner, repo, releaseType: "release" }] : undefined;
const publisherName = process.env.WIN_PUBLISHER_NAME;

module.exports = {
  appId: brand.appId,
  productName: brand.productName,
  executableName: brand.executableName,
  copyright: brand.copyright,
  electronUpdaterCompatibility: ">= 2.16",
  ...(process.env.COOLTUNNEL_USE_LOCAL_ELECTRON === "true"
    ? { electronDist: path.resolve("node_modules", "electron", "dist") }
    : {}),
  directories: {
    output: process.env.COOLTUNNEL_OUTPUT_DIR || "release",
    buildResources: "build"
  },
  files: ["dist/**/*", "dist-electron/**/*", "package.json", "brand.config.json", "LICENSE", "THIRD_PARTY_NOTICES.md"],
  extraResources: [
    { from: "resources/bin", to: "bin", filter: ["**/*"] },
    { from: "build/icon.png", to: "icon.png" }
  ],
  publish,
  win: {
    target: "nsis",
    icon: path.join("build", "icon.ico"),
    signAndEditExecutable: process.env.COOLTUNNEL_SKIP_EXE_BRANDING !== "true"
      && process.env.LTC_SKIP_EXE_BRANDING !== "true",
    signExecutable: Boolean(process.env.CSC_LINK),
    ...(publisherName ? { publisherName } : {})
  },
  nsis: {
    guid: brand.legacyAppId,
    include: path.join("resources", "installer", "installer.nsh"),
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: brand.productName,
    artifactName: `${brand.releaseArtifactName}-\${version}.\${ext}`,
    installerIcon: path.join("build", "icon.ico"),
    uninstallerIcon: path.join("build", "icon.ico")
  }
};
