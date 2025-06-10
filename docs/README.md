# 🐛 Debugging `text-extractor-gnome`

Helpful commands and tips for debugging the GNOME Shell extension.

---

## 🧪 Run GNOME Shell in Nested Mode

Use this to test the extension in a safe environment:

```shell
    dbus-run-session -- gnome-shell --nested --wayland
```

## 🔄 Enable the Extension
```shell
    gnome-extensions enable text-extractor@imshaaz21.github.com
```

## 🐞 Debugging prefs.js
Since `prefs.js` runs in a separate process from GNOME Shell, use this to monitor logs:

```shell
    journalctl -f -o cat /usr/bin/gjs
```
