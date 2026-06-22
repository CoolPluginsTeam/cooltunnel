# CoolTunnel website package

Upload the **contents of this directory** into the server directory that serves:

`https://coolplugins.net/cooltunnel/`

The package is static HTML, CSS, JavaScript and images. It does not require a
database, WordPress installation or build process.

The included `.htaccess` keeps the CoolTunnel static routes separate from the
parent WordPress rewrite rules. Make sure hidden files are extracted or upload
`.htaccess` manually.

Included routes:

- `/cooltunnel/`
- `/cooltunnel/docs/`
- `/cooltunnel/support/`
- `/cooltunnel/privacy/`
- `/cooltunnel/license/`
- `/cooltunnel/third-party-notices/`
- `/cooltunnel/release-notes/`

Before each public release:

1. Confirm the current version on the home page and release-notes page.
2. Confirm the latest GitHub release URL.
3. Confirm all checksum/signing information on GitHub.
4. Run `npm run validate:site`.
5. Upload the new ZIP contents without adding another nested `cooltunnel`
   directory.
