UUID := text-extractor@imshaaz21.github.com
DEST := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: pack install uninstall nested
pack:      ## build dist/$(UUID).shell-extension.zip for extensions.gnome.org
	gnome-extensions pack extension --extra-source=ocr.js --extra-source=icons --force --out-dir=dist

install: pack ## install the packed build for the current user
	gnome-extensions install --force dist/$(UUID).shell-extension.zip
	@echo "Log out/in (Wayland) or press Alt+F2, r (X11), then: gnome-extensions enable $(UUID)"

uninstall:
	gnome-extensions uninstall $(UUID)

# Runs the code in extension/ (not the installed copy) in an isolated shell:
# own data dir, in-memory settings, so your real session is untouched.
# --nested was replaced by --devkit in GNOME 49. Override with SHELL_FLAGS=... if needed.
SHELL_MAJOR := $(shell gnome-shell --version | grep -o '[0-9]*' | head -1)
SHELL_FLAGS ?= $(shell [ $(SHELL_MAJOR) -ge 49 ] && echo --devkit || echo --nested --wayland)
DEV := $(CURDIR)/dist/dev
nested:    ## try the repo code in a throw-away GNOME Shell
	rm -rf $(DEV)
	mkdir -p $(DEV)/gnome-shell/extensions/$(UUID)
	cp -r extension/. $(DEV)/gnome-shell/extensions/$(UUID)/
	glib-compile-schemas $(DEV)/gnome-shell/extensions/$(UUID)/schemas
	XDG_DATA_HOME=$(DEV) XDG_CONFIG_HOME=$(DEV)/config GSETTINGS_BACKEND=memory \
	GSETTINGS_SCHEMA_DIR=$(DEV)/gnome-shell/extensions/$(UUID)/schemas \
	dbus-run-session -- bash -c 'gnome-shell $(SHELL_FLAGS) & sleep 6; gnome-extensions enable $(UUID); wait'
