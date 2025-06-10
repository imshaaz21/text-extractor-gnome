import Gio from 'gi://Gio';
import St from 'gi://St';
import GLib from 'gi://GLib';

import {Extension, gettext as _, ngettext, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const REQUIRED_DEPENDENCIES = [
    {
        command: 'tesseract',
        package: 'tesseract-ocr',
        description: 'OCR engine for text extraction'
    },
    {
        command: 'xclip',
        package: 'xclip',
        description: 'Clipboard utility'
    },
    {
        command: 'gnome-screenshot',
        package: 'gnome-screenshot',
        description: 'Screenshot utility'
    }
];


export default class TextExtractorExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._languageLabel = null;
        this._isExtracting = false;
    }

    enable() {
        try {
            this._settings = this.getSettings();
            this._createPanelButton();
            this._bindSettings();
            this._checkDependenciesOnStart();
        } catch (error) {
            this._logError('Failed to enable extension', error);
            this._showNotification(_('Text Extractor'), _('Failed to initialize extension'));
        }
    }

    disable() {
        try {
            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
            }
            this._settings = null;
            this._languageLabel = null;
            this._isExtracting = false;
        } catch (error) {
            this._logError('Failed to disable extension', error);
        }
    }

    _createPanelButton() {
        // Create panel indicator
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add icon with professional styling
        const icon = new St.Icon({
            icon_name: 'document-edit-symbolic',
            style_class: 'system-status-icon',
        });
        this._indicator.add_child(icon);

        // Create menu items
        this._createMenuItems();

        // Add to panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    _createMenuItems() {
        const menu = this._indicator.menu;

        // Extract Text action
        const extractItem = new PopupMenu.PopupMenuItem(_('Extract Text from Screen'));
        const extractIcon = new St.Icon({
            icon_name: 'edit-select-all-symbolic',
            style_class: 'popup-menu-icon',
        });
        extractItem.insert_child_at_index(extractIcon, 0);
        extractItem.connect('activate', () => this._extractText());
        menu.addMenuItem(extractItem);

        // Separator
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Language display
        this._languageLabel = new PopupMenu.PopupMenuItem('', {reactive: false});
        this._languageLabel.label.style_class = 'popup-menu-item-label';
        menu.addMenuItem(this._languageLabel);
        this._updateLanguageLabel();

        // Separator
        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Preferences
        const prefsItem = new PopupMenu.PopupMenuItem(_('Preferences'));
        const prefsIcon = new St.Icon({
            icon_name: 'preferences-system-symbolic',
            style_class: 'popup-menu-icon',
        });
        prefsItem.insert_child_at_index(prefsIcon, 0);
        prefsItem.connect('activate', () => this.openPreferences());
        menu.addMenuItem(prefsItem);
    }

    _bindSettings() {
        // Bind visibility setting
        this._settings.bind('show-indicator', this._indicator, 'visible',
            Gio.SettingsBindFlags.DEFAULT);

        // Listen for language changes
        this._settings.connect('changed::language', () => {
            this._updateLanguageLabel();
        });
    }

    _updateLanguageLabel() {
        const langCode = this._settings.get_string('language');
        const languages = this.metadata.languages || {eng: 'English'};
        const langName = languages[langCode] || langCode;
        this._languageLabel.label.text = `${_('Language')}: ${langName}`;
    }

    _checkDependenciesOnStart() {
        // Silently check dependencies on startup
        const missingDeps = this._getMissingDependencies();
        if (missingDeps.length > 0) {
            const depNames = missingDeps.map(dep => dep.package).join(', ');
            this._showNotification(
                _('Text Extractor - Missing Dependencies'),
                _(`Please install: ${depNames}`)
            );
        }
    }

    _checkAndReportDependencies() {
        const missingDeps = this._getMissingDependencies();

        if (missingDeps.length === 0) {
            this._showNotification(
                _('Text Extractor'),
                _('All dependencies are installed and ready!')
            );
        } else {
            const installCommands = this._generateInstallCommands(missingDeps);
            this._showDependencyDialog(missingDeps, installCommands);
        }
    }

    _getMissingDependencies() {
        const missing = [];

        for (const dep of REQUIRED_DEPENDENCIES) {
            if (!this._checkCommand(dep.command)) {
                missing.push(dep);
            }
        }

        // Check for tesseract language packs
        const langCode = this._settings.get_string('language') || 'eng';
        const languages = this.metadata.languages || {eng: 'English'};
        if (langCode !== 'eng' && !this._checkTesseractLanguage(langCode)) {
            missing.push({
                command: `tesseract-${langCode}`,
                package: `tesseract-ocr-${langCode}`,
                description: `Tesseract language pack for ${languages[langCode]}`
            });
        }

        return missing;
    }

    _checkCommand(command) {
        try {
            const [success] = GLib.spawn_command_line_sync(`which ${command}`);
            return success;
        } catch (e) {
            return false;
        }
    }

    _checkTesseractLanguage(langCode) {
        try {
            const [success, stdout] = GLib.spawn_command_line_sync('tesseract --list-langs');
            if (success) {
                const langs = new TextDecoder().decode(stdout);
                return langs.includes(langCode);
            }
        } catch (e) {
            this._logError("Failed to check Tesseract language", e);
        }
        return false;
    }

    _generateInstallCommands(missingDeps) {
        const packages = missingDeps.map(dep => dep.package).join(' ');

        return [
            `# Ubuntu/Debian:`,
            `sudo apt update && sudo apt install ${packages}`,
            ``,
            `# Fedora:`,
            `sudo dnf install ${packages.replace('tesseract-ocr', 'tesseract')}`,
            ``,
            `# Arch Linux:`,
            `sudo pacman -S ${packages.replace('tesseract-ocr', 'tesseract').replace('gnome-screenshot', 'gnome-screenshot')}`
        ].join('\n');
    }

    _showDependencyDialog(missingDeps, installCommands) {
        const depList = missingDeps.map(dep => `• ${dep.package} - ${dep.description}`).join('\n');

        this._showNotification(
            _('Text Extractor - Missing Dependencies'),
            _(`Missing dependencies:\n${depList}\n\nInstall commands copied to clipboard.`)
        );

        // Copy install commands to clipboard
        this._copyToClipboardDirect(installCommands);
    }

    _extractText() {
        if (this._isExtracting) {
            this._showNotification(_('Text Extractor'), _('Extraction already in progress...'));
            return;
        }

        const missingDeps = this._getMissingDependencies();
        if (missingDeps.length > 0) {
            this._checkAndReportDependencies();
            return;
        }

        this._isExtracting = true;
        const screenshotPath = `/tmp/text-extractor-screenshot-${Date.now()}.png`;
        const ocrOutputPath = `/tmp/text-extracted-${Date.now()}`;
        const langCode = this._settings.get_string('language') || 'eng';

        this._takeScreenshot(screenshotPath, ocrOutputPath, langCode);
    }

    _takeScreenshot(screenshotPath, ocrOutputPath, langCode) {
        try {
            const proc = Gio.Subprocess.new(
                ['gnome-screenshot', '-a', '-f', screenshotPath],
                Gio.SubprocessFlags.NONE
            );

            proc.wait_async(null, (proc, result) => {
                try {
                    const success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        const file = Gio.File.new_for_path(screenshotPath);
                        if (file.query_exists(null)) {
                            this._processOCR(screenshotPath, ocrOutputPath, langCode);
                        } else {
                            this._showNotification(_('Text Extractor'), _('Screenshot was cancelled'));
                            this._isExtracting = false;
                        }
                    } else {
                        this._showNotification(_('Text Extractor'), _('Screenshot failed'));
                        this._isExtracting = false;
                    }
                } catch (error) {
                    this._logError('Screenshot failed', error);
                    this._showNotification(_('Text Extractor'), _('Screenshot failed'));
                    this._isExtracting = false;
                }
            });

        } catch (error) {
            this._logError('Failed to start screenshot', error);
            this._showNotification(_('Text Extractor'), _('Failed to start screenshot'));
            this._isExtracting = false;
        }
    }

    _processOCR(screenshotPath, ocrOutputPath, langCode) {
        try {
            const proc = Gio.Subprocess.new(
                ['tesseract', screenshotPath, ocrOutputPath, '-l', langCode],
                Gio.SubprocessFlags.STDERR_PIPE
            );

            proc.wait_async(null, (proc, result) => {
                try {
                    const success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        this._readAndCopyText(ocrOutputPath, screenshotPath);
                    } else {
                        this._handleOCRError(proc);
                        this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
                        this._isExtracting = false;
                    }
                } catch (error) {
                    this._logError('OCR processing failed', error);
                    this._showNotification(_('Text Extractor'), _('OCR processing failed'));
                    this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
                    this._isExtracting = false;
                }
            });

        } catch (error) {
            this._logError('Failed to start OCR', error);
            this._showNotification(_('Text Extractor'), _('Failed to start OCR process'));
            this._cleanupTempFiles(screenshotPath);
            this._isExtracting = false;
        }
    }

    _handleOCRError(proc) {
        try {
            const stderr = proc.get_stderr_pipe();
            if (stderr) {
                const stream = new Gio.DataInputStream({
                    base_stream: stderr
                });
                const [line] = stream.read_line(null);
                const errorMsg = line ? new TextDecoder().decode(line) : '';

                if (errorMsg.includes('not installed') || errorMsg.includes('not found')) {
                    this._showNotification(_('Text Extractor'), _('Language pack not installed. Check dependencies.'));
                } else {
                    this._showNotification(_('Text Extractor'), _('OCR failed. Please try again.'));
                }
            } else {
                this._showNotification(_('Text Extractor'), _('OCR failed. Please try again.'));
            }
        } catch (error) {
            this._showNotification(_('Text Extractor'), _('OCR failed. Please try again.'));
        }
    }

    _readAndCopyText(ocrOutputPath, screenshotPath) {
        try {
            const file = Gio.File.new_for_path(`${ocrOutputPath}.txt`);

            if (!file.query_exists(null)) {
                this._showNotification(_('Text Extractor'), _('OCR output file not found'));
                this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
                this._isExtracting = false;
                return;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) {
                this._showNotification(_('Text Extractor'), _('Failed to read OCR output'));
                this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
                this._isExtracting = false;
                return;
            }

            const text = new TextDecoder().decode(contents).trim();

            if (!text) {
                this._showNotification(_('Text Extractor'), _('No text found in the selected area'));
                this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
                this._isExtracting = false;
                return;
            }

            this._copyToClipboard(text, screenshotPath, `${ocrOutputPath}.txt`);

        } catch (error) {
            this._logError('Failed to process extracted text', error);
            this._showNotification(_('Text Extractor'), _('Failed to process extracted text'));
            this._cleanupTempFiles(screenshotPath, `${ocrOutputPath}.txt`);
            this._isExtracting = false;
        }
    }

    _copyToClipboard(text, screenshotPath, ocrPath) {
        try {
            const proc = Gio.Subprocess.new(
                ['xclip', '-selection', 'clipboard'],
                Gio.SubprocessFlags.STDIN_PIPE
            );

            const stdin = proc.get_stdin_pipe();
            const stream = new Gio.DataOutputStream({
                base_stream: stdin
            });

            stream.put_string(text, null);
            stream.close(null);

            proc.wait_async(null, (proc, result) => {
                try {
                    const success = proc.wait_finish(result);
                    if (success && proc.get_exit_status() === 0) {
                        const wordCount = text.split(/\s+/).length;
                        this._showNotification(
                            _('Text Extractor'),
                            _(`Extracted text and copied to clipboard!`)
                        );
                    } else {
                        this._showNotification(_('Text Extractor'), _('Text extracted but failed to copy to clipboard'));
                    }
                } catch (error) {
                    this._logError('Clipboard operation failed', error);
                    this._showNotification(_('Text Extractor'), _('Text extracted but clipboard operation failed'));
                }

                this._cleanupTempFiles(screenshotPath, ocrPath);
                this._isExtracting = false;
            });

        } catch (error) {
            this._logError('Failed to copy to clipboard', error);
            this._showNotification(_('Text Extractor'), _('Text extracted but failed to copy to clipboard'));
            this._cleanupTempFiles(screenshotPath, ocrPath);
            this._isExtracting = false;
        }
    }

    _copyToClipboardDirect(text) {
        try {
            const proc = Gio.Subprocess.new(
                ['xclip', '-selection', 'clipboard'],
                Gio.SubprocessFlags.STDIN_PIPE
            );

            const stdin = proc.get_stdin_pipe();
            const stream = new Gio.DataOutputStream({
                base_stream: stdin
            });

            stream.put_string(text, null);
            stream.close(null);
        } catch (error) {
            this._logError('Failed to copy to clipboard', error);
        }
    }

    _cleanupTempFiles(...filePaths) {
        for (const filePath of filePaths) {
            if (filePath) {
                try {
                    const file = Gio.File.new_for_path(filePath);
                    if (file.query_exists(null)) {
                        file.delete(null);
                    }
                } catch (error) {
                    // Silent cleanup failure
                }
            }
        }
    }

    _showNotification(title, message) {
        try {
            Main.notify(title, message);
        } catch (error) {
            this._logError('Failed to show notification', error);
        }
    }

    _logError(message, error) {
        console.error(`[Text Extractor] ${message}:`, error);
    }
}
