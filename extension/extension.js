import Gio from 'gi://Gio';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Ocr from './ocr.js';

const SHELL_TOAST_ICON = 'screenshot-recorded-symbolic';
const AREA_MODE_BUTTONS = ['_selectionButton', '_screenButton', '_windowButton'];

export default class TextExtractorExtension extends Extension {
    enable() {
        this._cancellable = new Gio.Cancellable();
        this._settings = this.getSettings();
        this._isExtracting = false;
        this._ocrRunning = false;
        this._previousMode = null;
        this._uiSignals = [];

        this._createPanelButton();

        this._settings.bind('show-indicator', this._indicator, 'visible', Gio.SettingsBindFlags.DEFAULT);
        this._languageChangedId = this._settings.connect('changed::language', () => this._updateLanguageLabel());
    }

    disable() {
        this._cancellable.cancel();
        this._cancellable = null;

        this._disconnectScreenshotUI();
        this._settings.disconnect(this._languageChangedId);

        this._indicator.destroy();
        this._indicator = null;
        this._languageLabel = null;
        this._settings = null;
    }

    _createPanelButton() {
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._indicator.add_child(new St.Icon({
            icon_name: 'insert-text-symbolic',
            style_class: 'system-status-icon',
        }));

        const menu = this._indicator.menu;

        const extractItem = new PopupMenu.PopupImageMenuItem(_('Extract Text from Screen'), 'edit-select-all-symbolic');
        extractItem.connect('activate', () => this._extractText());
        menu.addMenuItem(extractItem);

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._languageLabel = new PopupMenu.PopupMenuItem('', {reactive: false});
        menu.addMenuItem(this._languageLabel);
        this._updateLanguageLabel();

        menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const prefsItem = new PopupMenu.PopupImageMenuItem(_('Preferences'), 'preferences-system-symbolic');
        prefsItem.connect('activate', () => this.openPreferences());
        menu.addMenuItem(prefsItem);

        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    _languages() {
        return Ocr.parseLanguages(this._settings.get_string('language'));
    }

    _tessdataDir() {
        return this._settings.get_string('tessdata-dir');
    }

    _updateLanguageLabel() {
        const names = this._languages().map(Ocr.languageName);
        this._languageLabel.label.text = _('Language: %s').format(names.join(', '));
    }

    // Resolves to a message describing what is missing, or null when OCR can run.
    async _findProblem() {
        const languages = this._languages();
        let missing;

        if (!Ocr.isInstalled()) {
            missing = ['tesseract'];
        } else {
            try {
                const installed = await Ocr.listLanguages(this._tessdataDir(), this._cancellable);
                missing = languages.filter(l => !installed.includes(l));
            } catch (e) {
                if (Ocr.isCancelled(e))
                    throw e;
                console.error(`Text Extractor: ${e.message}`);
                return _('Tesseract could not list its languages. Check the tessdata folder in Preferences.');
            }
        }

        if (missing.length === 0)
            return null;

        const command = Ocr.installCommand(languages);
        return command
            ? _('Missing: %s. Install with: %s').format(missing.join(', '), command)
            : _('Missing: %s. Please install Tesseract and its language data.').format(missing.join(', '));
    }

    async _extractText() {
        if (this._isExtracting)
            return;
        this._isExtracting = true;

        try {
            const problem = await this._findProblem();
            if (problem) {
                this._isExtracting = false;
                this._notify(problem);
                return;
            }

            const ui = Main.screenshotUI;
            this._connectUI(Main.messageTray, 'source-added', (_tray, source) => this._dropShellToast(source));
            this._connectUI(ui, 'screenshot-taken', (_ui, file) => this._onScreenshot(file));
            this._connectUI(ui, 'closed', () => {
                this._disconnectScreenshotUI();
                if (!this._ocrRunning)
                    this._isExtracting = false;
            });

            // Shell remembers the last capture mode, so note it and put it back afterwards.
            this._previousMode = AREA_MODE_BUTTONS.map(name => ui[name]).find(button => button?.checked);

            // Strip the UI down to a snipping tool: hide the mode and video buttons and capture
            // when the drag ends. These are private widgets, so every access is optional; if a
            // Shell release renames them the regular screenshot UI is shown instead.
            ui._panel?.hide();
            await ui.open();
            if (ui._selectionButton)
                ui._selectionButton.checked = true;
            if (ui._areaSelector && ui._onCaptureButtonClicked) {
                this._connectUI(ui._areaSelector, 'drag-ended', () => {
                    const [, , width, height] = ui._areaSelector.getGeometry();
                    if (width > 3 && height > 3)
                        ui._onCaptureButtonClicked().catch(e => console.error(`Text Extractor: ${e.message}`));
                });
            }
        } catch (e) {
            this._disconnectScreenshotUI();
            this._isExtracting = false;
            if (Ocr.isCancelled(e))
                return;
            console.error(`Text Extractor: ${e.message}`);
            this._notify(_('Failed to open the screenshot tool'));
        }
    }

    async _onScreenshot(file) {
        this._ocrRunning = true;
        try {
            const text = await Ocr.recognize(file.get_path(), this._languages(), this._tessdataDir(), this._cancellable);

            if (text) {
                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
                this._toast(_('Copied: %s').format(this._preview(text)));
            } else {
                this._toast(_('No text found'), 'dialog-information-symbolic');
            }
        } catch (e) {
            if (!Ocr.isCancelled(e)) {
                console.error(`Text Extractor: OCR failed: ${e.message}`);
                this._notify(_('OCR failed. Please try again.'));
            }
        } finally {
            // The screenshot only existed to be read, so don't leave it in Pictures.
            try {
                file.delete(null);
            } catch (e) {
                // already removed
            }
            this._ocrRunning = false;
            this._isExtracting = false;
        }
    }

    // Shell announces each capture with "paste the image from the clipboard", which is wrong
    // here because the clipboard receives text.
    _dropShellToast(source) {
        const icon = source.iconName ?? source.icon?.to_string?.();
        if (icon !== SHELL_TOAST_ICON)
            return;

        const id = source.connect('notification-added', (_source, notification) => {
            source.disconnect(id);
            notification.destroy();
        });
    }

    _connectUI(object, signal, callback) {
        this._uiSignals.push([object, object.connect(signal, callback)]);
    }

    _disconnectScreenshotUI() {
        for (const [object, id] of this._uiSignals)
            object.disconnect(id);
        this._uiSignals = [];
        Main.screenshotUI._panel?.show();

        if (this._previousMode) {
            this._previousMode.checked = true;
            this._previousMode = null;
        }
    }

    _preview(text) {
        const line = text.replace(/\s+/g, ' ');
        return line.length > 48 ? `${line.slice(0, 47)}…` : line;
    }

    _toast(message, icon = 'edit-copy-symbolic') {
        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new(icon), message);
    }

    _notify(message) {
        Main.notify(_('Text Extractor'), message);
    }
}
