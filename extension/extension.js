import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';

import {Extension, gettext as _, ngettext, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export default class TextExtractorExtension extends Extension {
    enable() {
        this._settings = this.getSettings();

        // Create panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add icon
        const icon = new St.Icon({
            icon_name: 'document-edit-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        // "Extract Text" action
        this._indicator.menu.addAction(_('Extract Text'), () => {
            this._extractText();
        });

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Display current language
        this._languageLabel = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._indicator.menu.addMenuItem(this._languageLabel);
        this._updateLanguageLabel(); // Set initially

        // Create Preferences menu item with icon
        const prefsItem = new PopupMenu.PopupMenuItem('');
        prefsItem.label.text = _('Preferences');

        const icon_pref = new St.Icon({
            icon_name: 'preferences-system-symbolic',  // settings gear icon
            style_class: 'popup-menu-icon',
        });

        prefsItem.insert_child_at_index(icon_pref, 0);

        prefsItem.connect('activate', () => {
            this.openPreferences();
        });

        this._indicator.menu.addMenuItem(prefsItem);

        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Bind visibility
        this._settings.bind('show-indicator', this._indicator, 'visible',
            Gio.SettingsBindFlags.DEFAULT);

        // Update label on language change
        this._settings.connect('changed::language', () => {
            this._updateLanguageLabel();
        });
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }

    _updateLanguageLabel() {
        const langCode = this._settings.get_string('language');
        const languages = this.metadata.languages || {eng: 'English'};
        const langName = languages[langCode] || langCode;
        this._languageLabel.label.text = `${_('Selected Language')}: ${_(langName)}`;
    }

    _extractText() {
        const screenshotPath = '/tmp/text-extractor-screenshot.png';
        const ocrOutputPath = '/tmp/text-extracted';
        const langCode = this._settings.get_string('language') || 'eng';

        // First, check if required tools are available
        this._checkDependencies(() => {
            this._takeScreenshot(screenshotPath, ocrOutputPath, langCode);
        });
    }

    _checkDependencies(callback) {
        // Check for screenshot tool (try multiple options)
        const screenshotTools = ['gnome-screenshot', 'import', 'scrot'];
        let foundTool = null;

        for (let tool of screenshotTools) {
            try {
                const [success] = GLib.spawn_command_line_sync(`which ${tool}`);
                if (success) {
                    foundTool = tool;
                    break;
                }
            } catch (e) {
                continue;
            }
        }

        if (!foundTool) {
            this._showAlert(_('No screenshot tool found. Please install gnome-screenshot, imagemagick, or scrot.'));
            return;
        }

        // Check for tesseract
        try {
            const [success] = GLib.spawn_command_line_sync('which tesseract');
            if (!success) {
                this._showAlert(_('Tesseract OCR not found. Please install tesseract-ocr.'));
                return;
            }
        } catch (e) {
            this._showAlert(_('Tesseract OCR not found. Please install tesseract-ocr.'));
            return;
        }

        // Check for xclip
        try {
            const [success] = GLib.spawn_command_line_sync('which xclip');
            if (!success) {
                this._showAlert(_('xclip not found. Please install xclip.'));
                return;
            }
        } catch (e) {
            this._showAlert(_('xclip not found. Please install xclip.'));
            return;
        }

        callback();
    }

    _takeScreenshot(screenshotPath, ocrOutputPath, langCode) {
        // Try different screenshot methods
        this._tryGnomeScreenshot(screenshotPath, ocrOutputPath, langCode);
    }

    _tryGnomeScreenshot(screenshotPath, ocrOutputPath, langCode) {
        try {
            // Use spawn_async with proper error handling
            let proc = Gio.Subprocess.new(
                ['gnome-screenshot', '-a', '-f', screenshotPath],
                Gio.SubprocessFlags.NONE
            );

            proc.wait_async(null, (proc, result) => {
                try {
                    let success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        // Check if file was created
                        let file = Gio.File.new_for_path(screenshotPath);
                        if (file.query_exists(null)) {
                            this._processOCR(screenshotPath, ocrOutputPath, langCode);
                        } else {
                            this._showAlert(_('Screenshot was cancelled or failed.'));
                        }
                    } else {
                        this._showAlert(_('Screenshot failed. Please try again.'));
                    }
                } catch (e) {
                    this._showAlert(_('Screenshot failed. Please try again.'));
                }
            });

        } catch (e) {
            this._showAlert(_('Screenshot failed. Please try again.'));
        }
    }

    _processOCR(screenshotPath, ocrOutputPath, langCode) {
        try {
            // Run Tesseract OCR using Gio.Subprocess
            let proc = Gio.Subprocess.new(
                ['tesseract', screenshotPath, ocrOutputPath, '-l', langCode],
                Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.wait_async(null, (proc, result) => {
                try {
                    let success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        this._readAndCopyText(ocrOutputPath);
                    } else {
                        // Get error message
                        let stderr = proc.get_stderr_pipe();
                        let stream = new Gio.DataInputStream({
                            base_stream: stderr
                        });
                        let [line] = stream.read_line(null);
                        let errorMsg = line ? new TextDecoder().decode(line) : 'Unknown error';
                        this._showAlert(_('OCR failed. Check if the selected language is installed.'));
                    }
                } catch (e) {
                    this._showAlert(_('OCR processing failed.'));
                }
            });

        } catch (e) {
            this._showAlert(_('Failed to start OCR process.'));
        }
    }

    _readAndCopyText(ocrOutputPath) {
        try {
            // Read the OCR output file
            let file = Gio.File.new_for_path(`${ocrOutputPath}.txt`);

            if (!file.query_exists(null)) {
                this._showAlert(_('OCR output file not found.'));
                return;
            }

            let [success, contents] = file.load_contents(null);
            if (!success) {
                this._showAlert(_('Failed to read OCR output.'));
                return;
            }

            let text = new TextDecoder().decode(contents).trim();

            if (!text) {
                this._showAlert(_('No text found in the image.'));
                return;
            }

            // Copy to clipboard
            this._copyToClipboard(text);

        } catch (e) {
            this._showAlert(_('Failed to process extracted text.'));
        }
    }

    _copyToClipboard(text) {
        try {
            // Use Gio.Subprocess for better clipboard handling
            let proc = Gio.Subprocess.new(
                ['xclip', '-selection', 'clipboard'],
                Gio.SubprocessFlags.STDIN_PIPE
            );

            let stdin = proc.get_stdin_pipe();
            let stream = new Gio.DataOutputStream({
                base_stream: stdin
            });

            stream.put_string(text, null);
            stream.close(null);

            proc.wait_async(null, (proc, result) => {
                try {
                    let success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        this._showAlert(_('Text extracted and copied to clipboard!'));
                    } else {
                        this._showAlert(_('Text extracted but failed to copy to clipboard.'));
                    }
                } catch (e) {
                    this._showAlert(_('Text extracted but clipboard operation failed.'));
                }

                this._cleanupTempFiles();
            });

        } catch (e) {
            this._showAlert(_('Text extracted but failed to copy to clipboard.'));
            this._cleanupTempFiles();
        }
    }

    _cleanupTempFiles() {
        // Clean up temporary files
        try {
            let screenshotFile = Gio.File.new_for_path('/tmp/text-extractor-screenshot.png');
            let ocrFile = Gio.File.new_for_path('/tmp/text-extracted.txt');

            if (screenshotFile.query_exists(null)) {
                screenshotFile.delete(null);
            }
            if (ocrFile.query_exists(null)) {
                ocrFile.delete(null);
            }
        } catch (e) {
        }
    }

    _showAlert(message) {
        const title = _('Text Extractor');
        const body = pgettext('notification body', message);
        Main.notify(title, body);
    }
}
