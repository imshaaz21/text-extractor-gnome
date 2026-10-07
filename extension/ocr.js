// Shared by extension.js and prefs.js. Prefs run in a separate GTK process, so only GLib and Gio here.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

export const isInstalled = () => GLib.find_program_in_path('tesseract') !== null;

export const isCancelled = error => error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED) ?? false;

// "eng+tam" is how Tesseract (and the language setting) names several languages at once.
export const parseLanguages = setting => setting.split('+').filter(Boolean);

const tessdataArgs = dir => (dir ? ['--tessdata-dir', dir] : []);

async function run(argv, cancellable) {
    const proc = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    const [stdout, stderr] = await proc.communicate_utf8_async(null, cancellable);
    if (!proc.get_successful())
        throw new Error(stderr?.trim() || `${argv[0]} exited with status ${proc.get_exit_status()}`);
    return stdout;
}

export async function listLanguages(tessdataDir, cancellable = null) {
    const output = await run(['tesseract', ...tessdataArgs(tessdataDir), '--list-langs'], cancellable);
    // First line is a header; "osd" is orientation data, not a language.
    return output.split('\n').slice(1).map(line => line.trim()).filter(code => code && code !== 'osd');
}

export async function recognize(imagePath, languages, tessdataDir, cancellable = null) {
    const text = await run(['tesseract', imagePath, 'stdout', '-l', languages.join('+'),
        ...tessdataArgs(tessdataDir)], cancellable);
    return text.trim();
}

// "tam" becomes "Tamil (tam)". Codes Intl does not know, such as custom models, are shown as-is.
export function languageName(code) {
    const base = code.split('_')[0];
    try {
        const name = new Intl.DisplayNames(undefined, {type: 'language'}).of(base);
        if (name && name !== base)
            return `${name} (${code})`;
    } catch (e) {
        // not a valid language tag
    }
    return code;
}

// Command that installs Tesseract and the given language packs, or null for an unknown distribution.
export function installCommand(languages = []) {
    const ids = [GLib.get_os_info('ID'), ...(GLib.get_os_info('ID_LIKE') ?? '').split(' ')];
    const isLike = (...names) => names.some(name => ids.includes(name));
    const packs = (prefix, separator = '_') => languages
        .filter(code => code !== 'eng') // ships with Tesseract
        .map(code => `${prefix}${code.replaceAll('_', separator)}`);

    if (isLike('debian', 'ubuntu'))
        return ['sudo apt install tesseract-ocr', ...packs('tesseract-ocr-', '-')].join(' ');
    if (isLike('fedora', 'rhel'))
        return ['sudo dnf install tesseract', ...packs('tesseract-langpack-')].join(' ');
    if (isLike('arch'))
        return ['sudo pacman -S tesseract', ...packs('tesseract-data-')].join(' ');
    if (isLike('suse', 'opensuse'))
        return ['sudo zypper install tesseract-ocr', ...packs('tesseract-ocr-traineddata-')].join(' ');
    return null;
}
