# Security Policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.
Use GitHub's private reporting: **Security** tab, then **Report a vulnerability**.
You will get a reply within a week.

## Scope

The extension runs inside the GNOME Shell process and starts `tesseract` with arguments built from its settings.
It does not use the network and does not read anything outside the screenshot it takes.
