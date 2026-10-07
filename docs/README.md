# Debugging

## Try the code in a safe shell

```bash
make nested
```

This copies `extension/` into a throw-away data directory and starts a nested GNOME Shell with the extension enabled.
Your real session and settings are not touched. On GNOME 49 and newer it uses `--devkit`, before that `--nested`.

## Logs

The extension runs inside the shell:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

Preferences run in a separate process:

```bash
journalctl -f -o cat /usr/bin/gjs
```

## Reload after a change

Wayland cannot restart the shell in place, so use `make nested` while developing, or log out and in.
