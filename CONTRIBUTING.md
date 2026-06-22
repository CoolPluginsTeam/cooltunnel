# Contributing to CoolTunnel

Thanks for helping improve CoolTunnel.

## Before opening an issue

- Use the newest release.
- Check the documentation and existing issues.
- Remove passwords, tokens, private URLs, customer content and unnecessary
  filesystem paths.
- Include the CoolTunnel version, Windows version and local server type.
- Export a redacted diagnostic bundle when it helps reproduce the problem.

## Development

```powershell
npm install
npm run dev
npm run test
npm run typecheck
npm run build
```

Place `cloudflared.exe` in `resources\bin` only for local packaging. The binary
is intentionally excluded from Git; release automation downloads the official
Windows binary.

## Pull requests

- Keep changes focused.
- Add or update tests for behavior changes.
- Preserve context isolation and avoid renderer access to Node.js.
- Use argument arrays for child processes; never add shell-built commands.
- Preserve the marked, reversible WordPress edit model.
- Run tests, type checks, the production build and site validation.

By contributing, you agree that your contribution is licensed under the MIT
License.
