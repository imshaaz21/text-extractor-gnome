import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TextExtractorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_title(_('Text Extractor Preferences'));
        window.set_default_size(600, 500);

        // A cleanup object to track resources
        const cleanup = {
            settings: null,
            languageStatusRow: null,
            statusIcon: null,
            depRows: {},
            pendingOperations: new Set()
        };

        window.connect('close-request', () => {
            cleanup.pendingOperations.forEach(cancellable => {
                if (cancellable && !cancellable.is_cancelled()) {
                    cancellable.cancel();
                }
            });
            cleanup.pendingOperations.clear();

            cleanup.settings = null;
            cleanup.languageStatusRow = null;
            cleanup.statusIcon = null;
            cleanup.depRows = null;
        });

        cleanup.settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        // Create preference groups
        this._createAppearanceGroup(page, cleanup);
        this._createLanguageGroup(page, cleanup);
        this._createDependenciesGroup(page, cleanup);
        this._createAboutGroup(page);
    }

    _createAppearanceGroup(page, cleanup) {
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure how the extension appears in your desktop'),
        });
        page.add(appearanceGroup);

        // Show indicator toggle
        const showIndicatorRow = new Adw.SwitchRow({
            title: _('Show Panel Indicator'),
            subtitle: _('Display the Text Extractor icon in the top panel'),
        });

        cleanup.settings.bind('show-indicator', showIndicatorRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);

        appearanceGroup.add(showIndicatorRow);
    }

    _createLanguageGroup(page, cleanup) {
        const languageGroup = new Adw.PreferencesGroup({
            title: _('OCR Language'),
            description: _('Select the language for optical character recognition'),
        });
        page.add(languageGroup);

        // Get current language
        let currentLang = cleanup.settings.get_string('language');

        const rawLangs = this.metadata.languages || {eng: 'English'};
        const LANGUAGES = {};

        for (const [code, name] of Object.entries(rawLangs)) {
            LANGUAGES[code] = _(name);
        }

        if (!Object.keys(LANGUAGES).includes(currentLang)) {
            currentLang = 'eng';
            cleanup.settings.set_string('language', currentLang);
        }

        let buttonGroup = null;

        for (const [code, name] of Object.entries(LANGUAGES)) {
            const row = new Adw.ActionRow({
                title: name,
                subtitle: this._getLanguageSubtitle(code),
            });

            const button = new Gtk.CheckButton({
                valign: Gtk.Align.CENTER,
            });

            if (buttonGroup === null) {
                buttonGroup = button;
            } else {
                button.group = buttonGroup;
            }

            button.active = currentLang === code;

            button.connect('toggled', (btn) => {
                if (btn.active) {
                    cleanup.settings.set_string('language', code);
                    this._updateLanguageStatus(cleanup);
                }
            });

            row.add_suffix(button);
            row.activatable_widget = button;
            languageGroup.add(row);
        }

        this._createLanguageStatusRow(languageGroup, cleanup);
    }

    _createLanguageStatusRow(group, cleanup) {
        cleanup.languageStatusRow = new Adw.ActionRow({
            title: _('Language Pack Status'),
            subtitle: _('Checking...'),
        });

        cleanup.statusIcon = new Gtk.Image({
            icon_name: 'content-loading-symbolic',
            valign: Gtk.Align.CENTER,
        });

        cleanup.languageStatusRow.add_suffix(cleanup.statusIcon);
        group.add(cleanup.languageStatusRow);

        // Initial status check
        this._updateLanguageStatus(cleanup);
    }

    _createDependenciesGroup(page, cleanup) {
        const depsGroup = new Adw.PreferencesGroup({
            title: _('System Dependencies'),
            description: _('Required system packages for text extraction'),
        });
        page.add(depsGroup);

        const checkDepsRow = new Adw.ActionRow({
            title: _('Check Dependencies'),
            subtitle: _('Verify that all required packages are installed'),
        });

        const checkButton = new Gtk.Button({
            label: _('Check Now'),
            css_classes: ['suggested-action'],
            valign: Gtk.Align.CENTER,
        });

        checkButton.connect('clicked', () => {
            this._checkDependencies(cleanup);
        });

        checkDepsRow.add_suffix(checkButton);
        depsGroup.add(checkDepsRow);

        this._createDependencyStatusRows(depsGroup, cleanup);
    }

    _createDependencyStatusRows(group, cleanup) {
        const dependencies = [
            {
                name: 'tesseract',
                title: _('Tesseract OCR'),
                description: _('Optical Character Recognition engine'),
                package: 'tesseract-ocr'
            }
        ];

        for (const dep of dependencies) {
            const row = new Adw.ActionRow({
                title: dep.title,
                subtitle: dep.description,
            });

            const statusIcon = new Gtk.Image({
                icon_name: 'content-loading-symbolic',
                valign: Gtk.Align.CENTER,
            });

            row.add_suffix(statusIcon);
            group.add(row);

            cleanup.depRows[dep.name] = {
                row: row,
                icon: statusIcon,
                package: dep.package
            };
        }
    }

    _createAboutGroup(page) {
        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
            description: _('Information about Text Extractor extension'),
        });
        page.add(aboutGroup);

        // Version info
        const versionRow = new Adw.ActionRow({
            title: _('Version'),
            subtitle: this.metadata['version-name'] || '1.0.0',
        });
        aboutGroup.add(versionRow);

        // GitHub link
        const githubRow = new Adw.ActionRow({
            title: _('Source Code'),
            subtitle: _('View on GitHub'),
        });

        const githubButton = new Gtk.Button({
            icon_name: 'web-browser-symbolic',
            tooltip_text: _('Open GitHub Repository'),
            valign: Gtk.Align.CENTER,
        });

        githubButton.connect('clicked', () => {
            const url = this.metadata.url || 'https://github.com/imshaaz21/text-extractor-gnome';
            Gio.AppInfo.launch_default_for_uri(url, null);
        });

        githubRow.add_suffix(githubButton);
        aboutGroup.add(githubRow);

        // Report issues
        const issuesRow = new Adw.ActionRow({
            title: _('Report Issues'),
            subtitle: _('Found a bug? Report it on GitHub'),
        });

        const issuesButton = new Gtk.Button({
            icon_name: 'bug-symbolic',
            tooltip_text: _('Report an Issue'),
            valign: Gtk.Align.CENTER,
        });

        issuesButton.connect('clicked', () => {
            const url = (this.metadata.url || 'https://github.com/imshaaz21/text-extractor-gnome') + '/issues';
            Gio.AppInfo.launch_default_for_uri(url, null);
        });

        issuesRow.add_suffix(issuesButton);
        aboutGroup.add(issuesRow);
    }

    _getLanguageSubtitle(code) {
        switch (code) {
            case 'eng':
                return _('English script, widely supported');
            case 'tam':
                return _('Tamil script, requires language pack');
            default:
                return _('Language code: ') + code;
        }
    }

    _updateLanguageStatus(cleanup) {
        if (!cleanup.languageStatusRow) return;

        const currentLang = cleanup.settings.get_string('language');
        const cancellable = new Gio.Cancellable();
        cleanup.pendingOperations.add(cancellable);

        // Check if the language is available
        this._checkTesseractLanguage(currentLang, cancellable).then((available) => {
            if (cancellable.is_cancelled()) return;

            cleanup.pendingOperations.delete(cancellable);

            if (available) {
                cleanup.languageStatusRow.subtitle = _('Language pack is installed and ready');
                cleanup.statusIcon.icon_name = 'emblem-ok-symbolic';
                cleanup.statusIcon.css_classes = ['success'];
            } else {
                cleanup.languageStatusRow.subtitle = _('Language pack not found - please install it');
                cleanup.statusIcon.icon_name = 'dialog-warning-symbolic';
                cleanup.statusIcon.css_classes = ['warning'];
            }
        }).catch(() => {
            if (cancellable.is_cancelled()) return;

            cleanup.pendingOperations.delete(cancellable);
            cleanup.languageStatusRow.subtitle = _('Unable to check language pack status');
            cleanup.statusIcon.icon_name = 'dialog-error-symbolic';
            cleanup.statusIcon.css_classes = ['error'];
        });
    }

    _checkDependencies(cleanup) {
        if (!cleanup.depRows) return;

        for (const [depName, depInfo] of Object.entries(cleanup.depRows)) {
            const cancellable = new Gio.Cancellable();
            cleanup.pendingOperations.add(cancellable);

            this._checkCommand(depName, cancellable).then((available) => {
                if (cancellable.is_cancelled()) return;

                cleanup.pendingOperations.delete(cancellable);

                if (available) {
                    depInfo.icon.icon_name = 'emblem-ok-symbolic';
                    depInfo.icon.css_classes = ['success'];
                    depInfo.row.subtitle = _('Installed and ready');
                } else {
                    depInfo.icon.icon_name = 'dialog-error-symbolic';
                    depInfo.icon.css_classes = ['error'];
                    depInfo.row.subtitle = _('Not installed') + depInfo.package;
                }
            }).catch(() => {
                if (cancellable.is_cancelled()) return;

                cleanup.pendingOperations.delete(cancellable);
                depInfo.icon.icon_name = 'dialog-warning-symbolic';
                depInfo.icon.css_classes = ['warning'];
                depInfo.row.subtitle = _('Unable to check status');
            });
        }

        this._updateLanguageStatus(cleanup);
    }

    _checkCommand(command, cancellable) {
        return new Promise((resolve, reject) => {
            if (cancellable.is_cancelled()) {
                resolve(false);
                return;
            }

            const proc = Gio.Subprocess.new(
                ['which', command],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.wait_async(cancellable, (proc, result) => {
                if (cancellable.is_cancelled()) {
                    resolve(false);
                    return;
                }

                try {
                    const success = proc.wait_finish(result);
                    resolve(success && proc.get_exit_status() === 0);
                } catch (error) {
                    resolve(false);
                }
            });
        });
    }

    _checkTesseractLanguage(langCode, cancellable) {
        return new Promise((resolve, reject) => {
            if (cancellable.is_cancelled()) {
                resolve(false);
                return;
            }

            const proc = Gio.Subprocess.new(
                ['tesseract', '--list-langs'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE
            );

            proc.communicate_utf8_async(null, cancellable, (proc, result) => {
                if (cancellable.is_cancelled()) {
                    resolve(false);
                    return;
                }

                try {
                    const [success, stdout, stderr] = proc.communicate_utf8_finish(result);
                    if (success) {
                        const langs = stdout.toLowerCase();
                        resolve(langs.includes(langCode.toLowerCase()));
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    resolve(false);
                }
            });
        });
    }
}
