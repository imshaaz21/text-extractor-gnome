UUID := text-extractor@imshaaz21.github.com
INSTALL_DIR := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all setup build install install-dev uninstall test clean

all: build

setup:
	glib-compile-schemas extension/schemas

build: setup
	@echo "Building extension..."
	mkdir -p build/$(UUID)
	cp -r extension/* build/$(UUID)

install: build
	@echo "Installing extension..."
	mkdir -p $(INSTALL_DIR)
	cp -r build/$(UUID)/* $(INSTALL_DIR)
	gnome-extensions enable $(UUID)

install-dev: setup
	@echo "Installing for development..."
	mkdir -p $(INSTALL_DIR)
	cp -r extension/* $(INSTALL_DIR)
	gnome-extensions enable $(UUID)

uninstall:
	@echo "Uninstalling extension..."
	rm -rf $(INSTALL_DIR)
	gnome-extensions disable $(UUID)

test:
	python -m pytest tests/ -v
