import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class TextExtractorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        // === Appearance Group ===
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the extension'),
        });
        page.add(appearanceGroup);

        const showIndicatorRow = new Adw.SwitchRow({
            title: _('Show Indicator'),
            subtitle: _('Toggle to show or hide the extension icon in the top panel'),
        });
        appearanceGroup.add(showIndicatorRow);

        // === Language Group ===
        const languageGroup = new Adw.PreferencesGroup({
            title: _('Language'),
            description: _('Select the OCR language'),
        });
        page.add(languageGroup);

        // === Settings & Language Logic ===
        window._settings = this.getSettings();
        window._settings.bind('show-indicator', showIndicatorRow, 'active', Gio.SettingsBindFlags.DEFAULT);

        const rawLangs = this.metadata.languages || { eng: 'English' };
        const LANGUAGES = {};

        for (const [code, name] of Object.entries(rawLangs)) {
            LANGUAGES[code] = _(name);
        }

        let currentLang = window._settings.get_string('language');
        if (!Object.keys(LANGUAGES).includes(currentLang)) {
            currentLang = 'eng';
            window._settings.set_string('language', currentLang);
        }

        let buttonGroup = null;

        for (const [code, label] of Object.entries(LANGUAGES)) {
            const row = new Adw.ActionRow({title: label});

            const button = new Gtk.CheckButton({});
            if (buttonGroup === null) {
                buttonGroup = button;
            } else {
                button.group = buttonGroup;
            }

            button.active = currentLang === code;

            button.connect('toggled', (btn) => {
                if (btn.active) {
                    window._settings.set_string('language', code);
                }
            });

            row.add_suffix(button);
            row.activatable_widget = button;
            languageGroup.add(row);
        }
    }
}
