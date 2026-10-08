# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keep-a-changelog.com/en/1.1.0/).

## [1.1.2]

### Changed
- Renamed to "OCR Text Extractor" so it is easy to tell apart from other extensions called "Text Extractor".
- The description now mentions PowerToys Text Extractor, which this extension is the GNOME equivalent of.

## [1.1.1]

### Changed
- The extension description says that Tesseract OCR must be installed.
- The install command for a missing Tesseract or language pack is no longer exported as a string. `notifyInstallCommand()` passes it to a notification (or the preferences status row) only, so it cannot be used in a spawn call.

## [1.1.0]

### Added
- Any language installed for Tesseract can be used, including several at once (`eng+tam`).
- Custom tessdata folder for user-supplied `.traineddata` files.
- Preferences show the install command for the user's distribution when Tesseract or a language is missing.
- Support for GNOME Shell 45 to 50.

### Changed
- Screenshots use GNOME's built-in screenshot UI, reduced to area selection, instead of `gnome-screenshot`.
- Text goes to the clipboard through `St.Clipboard` instead of `xclip`.
- The capture mode Shell remembers (selection, screen or window) is restored after each extraction, so the normal screenshot tool is unchanged.
- Success feedback is a short on-screen toast instead of a notification, and Shell's own "Screenshot captured" notification is dismissed for these captures.
- All subprocess calls are asynchronous and no longer block the shell.
- Preferences no longer keep widget references after the window closes.

### Removed
- `gnome-screenshot` and `xclip` dependencies.
- `scripts/install-dependencies.sh`, replaced by in-app install hints.
- Unused `stylesheet.css` and unsupported shell version entries.

## [1.0.0]

- Initial release.
