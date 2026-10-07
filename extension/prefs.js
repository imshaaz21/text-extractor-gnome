import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as Ocr from './ocr.js';

export default class TextExtractorPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // State lives in this closure rather than on `this`, so it is collected when the window closes.
        const settings = this.getSettings();
        let scan = null;
        let installCmd = null;
        let languageRows = [];

        window.set_title(_('Text Extractor Preferences'));
        window.set_default_size(600, 640);
        window.connect('close-request', () => {
            scan?.cancel();
            scan = null;
            languageRows = [];
        });

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const appearance = new Adw.PreferencesGroup({title: _('Appearance')});
        const indicatorRow = new Adw.SwitchRow({
            title: _('Show Panel Indicator'),
            subtitle: _('Display the Text Extractor icon in the top panel'),
        });
        settings.bind('show-indicator', indicatorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearance.add(indicatorRow);
        page.add(appearance);

        const shortcut = new Adw.PreferencesGroup({title: _('Shortcut')});
        shortcut.add(this._shortcutRow(window, settings));
        page.add(shortcut);

        const ocr = new Adw.PreferencesGroup({
            title: _('Text Recognition'),
            description: _('Any language installed for Tesseract can be used. Pick several to read mixed-language text.'),
        });
        page.add(ocr);

        const statusIcon = new Gtk.Image({valign: Gtk.Align.CENTER});
        const statusRow = new Adw.ActionRow({title: _('Status'), use_markup: false, subtitle_lines: 0});
        statusRow.add_prefix(statusIcon);

        const copyButton = new Gtk.Button({
            icon_name: 'edit-copy-symbolic',
            tooltip_text: _('Copy install command'),
            valign: Gtk.Align.CENTER,
            visible: false,
        });
        const refreshButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            tooltip_text: _('Check again'),
            valign: Gtk.Align.CENTER,
        });
        statusRow.add_suffix(copyButton);
        statusRow.add_suffix(refreshButton);
        ocr.add(statusRow);

        const languagesRow = new Adw.ExpanderRow({title: _('Languages')});
        ocr.add(languagesRow);

        const tessdataRow = new Adw.EntryRow({
            title: _('Tessdata folder (replaces the system one)'),
            text: settings.get_string('tessdata-dir'),
            show_apply_button: true,
        });
        ocr.add(tessdataRow);
        ocr.add(this._linkRow(_('Download more languages'), 'https://github.com/tesseract-ocr/tessdata_best',
            'folder-download-symbolic'));

        const about = new Adw.PreferencesGroup({title: _('About')});
        about.add(new Adw.ActionRow({
            title: _('Version'),
            subtitle: this.metadata['version-name'],
        }));
        about.add(this._linkRow(_('Source Code'), this.metadata.url, 'web-browser-symbolic'));
        about.add(this._linkRow(_('Report an Issue'), `${this.metadata.url}/issues`, 'bug-symbolic'));
        page.add(about);

        const selected = () => Ocr.parseLanguages(settings.get_string('language'));

        const setStatus = (kind, text, command = null) => {
            statusIcon.icon_name = {
                ok: 'emblem-ok-symbolic',
                warn: 'dialog-warning-symbolic',
                error: 'dialog-error-symbolic',
            }[kind];
            statusIcon.css_classes = [{ok: 'success', warn: 'warning', error: 'error'}[kind]];
            statusRow.subtitle = text;
            installCmd = command;
            copyButton.visible = command !== null;
        };

        const clearLanguages = () => {
            for (const row of languageRows)
                languagesRow.remove(row);
            languageRows = [];
        };

        const refreshSummary = () => {
            languagesRow.subtitle = selected().map(Ocr.languageName).join(', ');
        };

        const buildLanguages = installed => {
            clearLanguages();
            // Show a configured-but-missing language too, so the user sees why it is flagged.
            const codes = [...new Set([...installed, ...selected()])];

            for (const code of codes) {
                const check = new Gtk.CheckButton({
                    valign: Gtk.Align.CENTER,
                    active: selected().includes(code),
                });
                const row = new Adw.ActionRow({
                    title: Ocr.languageName(code),
                    subtitle: installed.includes(code) ? '' : _('Not installed'),
                    activatable_widget: check,
                });
                row.add_suffix(check);
                row.code = code;
                row.check = check;
                check.connect('toggled', () => {
                    const chosen = languageRows.filter(r => r.check.active).map(r => r.code);
                    if (chosen.length === 0) {
                        check.active = true; // at least one language is required
                        return;
                    }
                    settings.set_string('language', chosen.join('+'));
                    refresh();
                });
                languagesRow.add_row(row);
                languageRows.push(row);
            }
            refreshSummary();
        };

        async function refresh() {
            scan?.cancel();
            const cancellable = scan = new Gio.Cancellable();
            setStatus('warn', _('Checking…'));

            try {
                if (!Ocr.isInstalled()) {
                    clearLanguages();
                    const cmd = Ocr.installCommand(selected());
                    setStatus('error', cmd
                        ? _('Tesseract is not installed. Run: %s').format(cmd)
                        : _('Tesseract is not installed. Install it with your package manager.'), cmd);
                    return;
                }

                const installed = await Ocr.listLanguages(settings.get_string('tessdata-dir'), cancellable);
                if (cancellable.is_cancelled())
                    return;

                const missing = selected().filter(l => !installed.includes(l));
                if (missing.length === 0) {
                    setStatus('ok', _('Ready. %d languages available.').format(installed.length));
                } else {
                    const cmd = Ocr.installCommand(missing);
                    setStatus('warn', cmd
                        ? _('Missing: %s. Run: %s').format(missing.join(', '), cmd)
                        : _('Missing: %s. Install the matching Tesseract language data.').format(missing.join(', ')),
                    cmd);
                }
                // Rebuild the rows only when the set of languages changed (not on every tick).
                const wanted = [...new Set([...installed, ...selected()])];
                if (wanted.join() !== languageRows.map(r => r.code).join())
                    buildLanguages(installed);
                else
                    refreshSummary();
            } catch (e) {
                if (cancellable.is_cancelled())
                    return;
                console.error(`[Text Extractor] ${e.message}`);
                clearLanguages();
                setStatus('error', _('Tesseract could not list its languages. Check the tessdata folder below.'));
            }
        }

        copyButton.connect('clicked', () => {
            if (installCmd)
                Gdk.Display.get_default().get_clipboard().set(installCmd);
        });
        refreshButton.connect('clicked', () => refresh());
        tessdataRow.connect('apply', () => {
            settings.set_string('tessdata-dir', tessdataRow.text.trim());
            refresh();
        });

        refresh();
    }

    /** Row showing the current shortcut; activating it opens a small key-capture window. */
    _shortcutRow(window, settings) {
        const KEY = 'extract-shortcut';
        const shown = new Gtk.ShortcutLabel({valign: Gtk.Align.CENTER, disabled_text: _('Disabled')});
        const sync = () => {
            shown.accelerator = settings.get_strv(KEY)[0] ?? '';
        };
        sync();
        const changedId = settings.connect(`changed::${KEY}`, sync);
        window.connect('close-request', () => settings.disconnect(changedId));

        const row = new Adw.ActionRow({
            title: _('Extract Text'),
            subtitle: _('Click to change. Works from anywhere in the desktop.'),
            activatable: true,
        });
        row.add_suffix(shown);

        row.connect('activated', () => {
            const dialog = new Gtk.Window({
                title: _('Set Shortcut'),
                modal: true,
                transient_for: window,
                resizable: false,
                default_width: 360,
                default_height: 140,
                child: new Gtk.Label({
                    label: _('Press the new shortcut\nEsc cancels, Backspace disables'),
                    justify: Gtk.Justification.CENTER,
                    margin_top: 24, margin_bottom: 24, margin_start: 24, margin_end: 24,
                }),
            });

            const keys = new Gtk.EventControllerKey();
            keys.connect('key-pressed', (_c, keyval, _keycode, state) => {
                const mods = state & Gtk.accelerator_get_default_mod_mask();
                if (mods === 0 && keyval === Gdk.KEY_Escape) {
                    dialog.close();
                } else if (mods === 0 && keyval === Gdk.KEY_BackSpace) {
                    settings.set_strv(KEY, []);
                    dialog.close();
                } else if (Gtk.accelerator_valid(keyval, mods)) { // ignores bare modifier presses
                    settings.set_strv(KEY, [Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), mods)]);
                    dialog.close();
                }
                return Gdk.EVENT_STOP;
            });
            dialog.add_controller(keys);
            dialog.present();
        });
        return row;
    }

    _linkRow(title, url, icon) {
        const row = new Adw.ActionRow({title, subtitle: url, activatable: true});
        row.add_suffix(new Gtk.Image({icon_name: icon, valign: Gtk.Align.CENTER}));
        row.connect('activated', () => Gio.AppInfo.launch_default_for_uri(url, null));
        return row;
    }
}
