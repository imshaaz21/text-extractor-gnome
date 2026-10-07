# Contributing

Thanks for helping out. Bug reports, translations and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/imshaaz21/text-extractor-gnome/issues/new/choose) and include:

- GNOME Shell version (`gnome-shell --version`) and distribution
- Tesseract version (`tesseract --version`) and the language you used
- Output of `journalctl -f -o cat /usr/bin/gnome-shell` while reproducing

## Development setup

```bash
git clone https://github.com/imshaaz21/text-extractor-gnome.git
cd text-extractor-gnome
make nested   # runs extension/ in a throw-away GNOME Shell, your session is untouched
```

Preferences run in a separate process, so watch their log with `journalctl -f -o cat /usr/bin/gjs`.

Code layout:

| File | Purpose |
|---|---|
| `extension/extension.js` | Panel menu, shortcut, screenshot to OCR to clipboard |
| `extension/prefs.js` | Preferences window |
| `extension/ocr.js` | Tesseract helpers shared by both |
| `extension/schemas/` | GSettings schema |

## Guidelines

These follow the [extensions.gnome.org review guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html), which every release is checked against.

- No synchronous subprocesses and no blocking calls in the shell process.
- Disconnect every signal and destroy every object in `disable()` and on window close.
- No `try`/`catch` around `enable()` or `disable()`.
- Wrap user-visible strings in `_()`. Never put translatable text in a template literal.
- Do not ship files that are not used.
- Keep comments for the reasons that are not obvious from the code.

## Pull requests

1. Branch from `main` (`feature/<short-name>` or `fix/<short-name>`).
2. Keep each change focused, and add an entry to `CHANGELOG.md`.
3. Test on a real GNOME Shell and say which version in the PR.
