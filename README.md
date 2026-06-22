# CoolTunnel

**CoolTunnel by Cool Plugins** shares local development sites through temporary
Cloudflare Quick Tunnel URLs.

> Share local sites instantly.

CoolTunnel is a free, MIT-licensed, Windows-first desktop utility created by
Satinder Singh at Cool Plugins LLP. It supports Local, Laragon, XAMPP,
WampServer and WordPress without requiring an account or collecting telemetry.

## Features

- Starts and stops Cloudflare Quick Tunnels without shell command execution
- Supports Local Site Domains, localhost ports, virtual hosts and subfolders
- Routes through a loopback-only proxy so public and local hostnames remain correct
- Detects and rewrites WordPress links, redirects, media and wp-admin URLs
- Creates reversible WordPress changes with timestamped backups
- Saves reusable profiles and sanitized profile packs
- Includes live logs, compatibility checks and privacy-safe diagnostics
- Bundles branded Windows packaging and GitHub Release update support
- Preserves settings and profiles when upgrading from Local to Cloud 1.x

## Privacy and safety

CoolTunnel has no account system, telemetry or remote collection of local paths,
site content or logs. Settings remain in the Windows application-data folder.
The proxy listens only on `127.0.0.1`, renderer access is context-isolated, and
external processes are started with argument arrays.

Quick Tunnels are intended for development and previews. They have no SLA and
must not be treated as production hosting.

## Requirements

- Windows 10 or newer
- Node.js 20 or newer for development
- npm
- `cloudflared.exe` in `resources\bin`, on PATH, or selected in Settings

## Development

```powershell
cd "C:\path\to\cooltunnel"
npm install
npm run dev
```

## Validation

```powershell
npm run test
npm run typecheck
npm run build
```

## Windows installer

```powershell
npm run package:win
```

The installer, blockmap, update metadata and checksum are written to `release`.
Local builds can remain unsigned for development. A public production release
must be signed by **Cool Plugins LLP**.

## Using CoolTunnel

1. Start the local site in Local, Laragon, XAMPP or WampServer.
2. Enter the address that opens locally, such as `http://cool-plugins.local`.
3. For WordPress, select the site folder and apply the optional reversible fix.
4. Start the tunnel.
5. Copy the generated `trycloudflare.com` link.
6. Stop the tunnel when the preview is finished.

Local installations are detected under common roots, including:

```text
C:\laragon\www
C:\xampp\htdocs
C:\wamp64\www
%USERPROFILE%\Local Sites
```

Custom roots can be added in Settings. Local installations using
`<site>\app\public` are resolved automatically.

## WordPress integration

New fixes use:

```text
// BEGIN COOLTUNNEL WORDPRESS FIX
// END COOLTUNNEL WORDPRESS FIX

# BEGIN COOLTUNNEL WP-ADMIN FIX
# END COOLTUNNEL WP-ADMIN FIX

wp-content\mu-plugins\cooltunnel.php
```

CoolTunnel recognizes and safely migrates managed Local to Cloud 1.x markers
and `local-to-cloud-tunnel.php`.

## Profiles and diagnostics

Profiles store local URL, router mode, WordPress path and fix preferences.
Exported profile packs omit local filesystem paths unless explicitly requested.

Diagnostic bundles redact user directories, executable paths, WordPress paths
and token-like values by default.

## Updates and signing

Tagged GitHub releases produce:

- Signed NSIS installer
- Blockmap
- `latest.yml`
- SHA-256 checksum
- Release notes

The initial 2.0.0 rollout is staged at 10%. Increase
`STAGING_PERCENTAGE` to 50 and then 100 after validation.

Signing secrets remain in CI. `WIN_PUBLISHER_NAME` must match
`Cool Plugins LLP` exactly.

## Product page

The deploy-ready static page is in `website/cooltunnel`. Generated web assets
are written to `build/website` by `npm run icons`.

Production URL: <https://coolplugins.net/cooltunnel/>

Documentation: <https://coolplugins.net/cooltunnel/docs/>

Source and releases: <https://github.com/CoolPluginsTeam/cooltunnel>

## License and attribution

CoolTunnel is available under the [MIT License](LICENSE).
See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled dependencies.

Copyright © 2026 Cool Plugins LLP.

Cloudflare, WordPress, Local, Laragon, XAMPP and WampServer are trademarks of
their respective owners. CoolTunnel is not affiliated with or endorsed by
those projects.
