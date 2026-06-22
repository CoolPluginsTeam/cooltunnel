# CoolTunnel 2.0.0

## A new production identity

- Local to Cloud is now **CoolTunnel by Cool Plugins**.
- New product identity, executable, installer, taskbar branding and website assets.
- Published by Cool Plugins LLP and created by Satinder Singh.
- Free, MIT licensed, account-free and telemetry-free.

## Seamless upgrade

- Replaces Local to Cloud 1.x through the existing NSIS upgrade identity.
- Migrates settings, profiles and the remembered local URL into the CoolTunnel data folder.
- Removes obsolete Local to Cloud shortcuts and refreshes Windows icons.
- Imports previous profile-pack schemas.
- Migrates managed WordPress blocks and the legacy must-use plugin to CoolTunnel identifiers.

## Production release

- Central versioned brand manifest and automated brand validation.
- Signed-release gate requiring the Cool Plugins LLP publisher.
- Signed NSIS installer, blockmap, update metadata and SHA-256 checksum.
- Initial staged rollout at 10%, with 50% and 100% promotion after validation.
- Deploy-ready product page, open-source notices and announcement copy.

# Local to Cloud 1.2.1

## LocalWP Site Domains hotfix

- Routes Quick Tunnels through a private loopback proxy so LocalWP receives its required local Host header while WordPress separately receives the real public hostname.
- Rewrites local redirect headers, HTML, CSS, JavaScript, JSON, XML, escaped URLs, and URL-encoded WooCommerce data.
- Keeps binary assets streaming without buffering or modification.
- Detects local redirects without silently following them.
- Migrates profiles and missing settings from the earlier lowercase application-data directory.
- Stops the routing proxy together with cloudflared.

# Local to Cloud 1.2.0

## LocalWP compatibility

- Supports LocalWP Site Domains and localhost router modes.
- Preserves dedicated localhost ports in the upstream Host header.
- Adds a reversible WordPress must-use URL bridge so internal links, assets, login, admin, and redirects use the active Quick Tunnel address.
- Adds an automatic public-homepage compatibility check for leaked local URLs.
- Keeps root and subfolder WordPress installations compatible without changing database URLs.

## Windows polish and efficiency

- Embeds the Local to Cloud icon and metadata into unsigned and signed Windows executables.
- Applies a stable Windows AppUserModelID for taskbar grouping and branding.
- Prevents duplicate app instances.
- Batches live log updates, caps session logs, and caches recent WordPress scans.
- Preserves the startup error window and diagnostic safeguards.

# Local to Cloud 1.1.1

## Startup hotfix

- Fixes a packaged updater import that could leave Electron processes running without opening a window.
- Adds a visible startup error page and local startup log for future initialization failures.
- Adds a five-second window visibility fallback.

## Team distribution

- Reusable site profiles with favorites and one-click tunnel startup
- Versioned, sanitized profile export and import
- Stable-channel GitHub Release updates with explicit download and install controls
- Branded Windows application and installer assets
- Privacy-safe diagnostic bundle export
- Release checksums, update metadata, and optional Windows certificate signing

## Existing capabilities

- Laragon, XAMPP, WAMP, LocalWP, localhost paths, and custom ports
- Bundled cloudflared Quick Tunnel support
- Reversible WordPress and wp-admin fixes with timestamped backups

Quick Tunnels are for development and testing. They are not intended for production hosting.
