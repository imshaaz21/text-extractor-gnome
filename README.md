# Text Extractor

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![GNOME Shell 45-51](https://img.shields.io/badge/GNOME_Shell-45%E2%80%9351-4a86cf)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy_me_a_coffee-FFDD00?style=flat&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/imshaaz)

A GNOME Shell extension for OCR on your screen: select an area, and the text in it (screenshot to text) is copied to the clipboard. It is the GNOME equivalent of PowerToys Text Extractor on Windows, and works with any language Tesseract supports.

| 1. Start | 2. Select | 3. Paste |
|:---:|:---:|:---:|
| ![Panel menu](docs/menu.png) | ![Selecting an area](docs/select.png) | ![Copied toast](docs/result.png) |
| Click the panel icon and choose Extract Text from Screen | Drag over the text, the capture happens when you let go | The text is on your clipboard |

## Features

- Uses GNOME's own screenshot overlay, reduced to area selection: the screen freezes, you drag, you are done
- Works with any language Tesseract has installed, and with several at once (`eng+tam`)
- Bring your own models: point the extension at a folder of `.traineddata` files
- Quiet: a short on-screen message on success, a notification only when something needs fixing
- Nothing is left behind: the temporary screenshot is deleted after reading

## Requirements

- GNOME Shell 45 to 51
- [Tesseract](https://github.com/tesseract-ocr/tesseract) and the language data you need

The extension does not install anything itself. When Tesseract or a language is missing, it tells you the exact command for your distribution, in the notification and in **Preferences → Text Recognition** (with a copy button).

| Distribution | Tesseract | A language, e.g. Tamil (`tam`) |
|---|---|---|
| Ubuntu, Debian | `sudo apt install tesseract-ocr` | `sudo apt install tesseract-ocr-tam` |
| Fedora | `sudo dnf install tesseract` | `sudo dnf install tesseract-langpack-tam` |
| Arch | `sudo pacman -S tesseract` | `sudo pacman -S tesseract-data-tam` |
| openSUSE | `sudo zypper install tesseract-ocr` | `sudo zypper install tesseract-ocr-traineddata-tam` |

Language codes are Tesseract's: `eng`, `deu`, `tam`, `sin`, `chi_sim` and so on. See the [full list](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html).

## Installation

```bash
git clone https://github.com/imshaaz21/text-extractor-gnome.git
cd text-extractor-gnome
make install
```

Log out and back in, then enable it:

```bash
gnome-extensions enable text-extractor@imshaaz21.github.com
```

To remove it: `make uninstall`.

## Usage

1. Click the Text Extractor icon in the top panel and choose **Extract Text from Screen**.
2. Drag over the text.
3. Paste it anywhere.

Press <kbd>Esc</kbd> to cancel.

## Preferences

| Setting | What it does |
|---|---|
| Languages | Tick one or more installed languages. Mixed-language text works when several are ticked. |
| Tessdata folder | Use your own `.traineddata` files, for example from [tessdata_best](https://github.com/tesseract-ocr/tessdata_best). Tesseract reads one folder only, so this **replaces** the system folder: put every language you need in it. |
| Show Panel Indicator | Hide or show the panel icon. |

## Troubleshooting

**"Missing: ..." message.** Run the command it shows, then press the refresh button in Preferences.

**The text is wrong or empty.** Select a larger area and make sure the right language is ticked. Tesseract reads clean, high-contrast text best.

**Something else.** Open an issue with the output of `journalctl -f -o cat /usr/bin/gnome-shell` while you reproduce it.

## Development

```bash
make nested   # run the code in extension/ in a throw-away GNOME Shell
make pack     # build dist/*.shell-extension.zip
```

```
extension/
├── extension.js   panel menu, screenshot to text to clipboard
├── prefs.js       preferences window
├── ocr.js         Tesseract helpers shared by both
├── metadata.json
└── schemas/       GSettings schema
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to get involved, [docs/README.md](docs/README.md) for debugging tips and [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

[GNU General Public License v3.0](LICENSE)
