# text-extractor-gnome

```shell
  dbus-run-session -- gnome-shell --nested --wayland
```


```shell
  gnome-extensions enable text-extractor@imshaaz21.github.com
```

### Debugging prefs.js
Because preferences are not run within gnome-shell but in a separate process, the logs will appear in the gjs process:

```shell
  journalctl -f -o cat /usr/bin/gjs
```

### Debugging GSettings
To help debug the changes made by prefs.js to GSettings values, you can use dconf to watch the path for your settings:

```shell
  dconf watch /org/gnome/shell/extensions/example
```
