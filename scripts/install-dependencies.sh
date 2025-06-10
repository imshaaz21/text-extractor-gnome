#!/bin/bash

# Text Extractor Extension - Dependency Installation Script
# This script helps users install required dependencies for the Text Extractor extension

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
check_command() {
    if command -v "$1" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to detect the Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo $ID
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    elif [ -f /etc/debian_version ]; then
        echo "debian"
    else
        echo "unknown"
    fi
}

# Function to install dependencies on Ubuntu/Debian
install_debian() {
    print_status "Installing dependencies for Ubuntu/Debian..."

    sudo apt update

    # Install basic dependencies
    sudo apt install -y tesseract-ocr xclip gnome-screenshot

    # Install Tamil language pack if requested
    if [ "$INSTALL_TAMIL" = "yes" ]; then
        print_status "Installing Tamil language pack..."
        sudo apt install -y tesseract-ocr-tam
    fi
}

# Function to install dependencies on Fedora
install_fedora() {
    print_status "Installing dependencies for Fedora..."

    sudo dnf install -y tesseract xclip gnome-screenshot

    # Install Tamil language pack if requested
    if [ "$INSTALL_TAMIL" = "yes" ]; then
        print_status "Installing Tamil language pack..."
        sudo dnf install -y tesseract-langpack-tam
    fi
}

# Function to verify installation
verify_installation() {
    print_status "Verifying installation..."

    local all_good=true

    # Check tesseract
    if check_command tesseract; then
        print_success "✓ Tesseract OCR is installed"

        # Check available languages
        local langs=$(tesseract --list-langs 2>/dev/null | tail -n +2)
        if echo "$langs" | grep -q "eng"; then
            print_success "  ✓ English language pack available"
        else
            print_warning "  ⚠ English language pack not found"
            all_good=false
        fi

        if [ "$INSTALL_TAMIL" = "yes" ]; then
            if echo "$langs" | grep -q "tam"; then
                print_success "  ✓ Tamil language pack available"
            else
                print_warning "  ⚠ Tamil language pack not found"
                all_good=false
            fi
        fi
    else
        print_error "✗ Tesseract OCR is not installed"
        all_good=false
    fi

    # Check xclip
    if check_command xclip; then
        print_success "✓ xclip is installed"
    else
        print_error "✗ xclip is not installed"
        all_good=false
    fi

    # Check gnome-screenshot
    if check_command gnome-screenshot; then
        print_success "✓ gnome-screenshot is installed"
    else
        print_error "✗ gnome-screenshot is not installed"
        all_good=false
    fi

    if [ "$all_good" = true ]; then
        print_success "All dependencies are properly installed!"
        print_status "You can now use the Text Extractor extension."
    else
        print_error "Some dependencies are missing or not properly installed."
        return 1
    fi
}

# Main installation function
main() {
    echo "=================================================="
    echo "  Text Extractor Extension - Dependency Installer"
    echo "=================================================="
    echo

    # Ask about Tamil language support
    read -p "Do you want to install Tamil language support? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        INSTALL_TAMIL="yes"
        print_status "Tamil language support will be installed."
    else
        INSTALL_TAMIL="no"
        print_status "Only English language support will be installed."
    fi
    echo

    # Detect distribution and install accordingly
    local distro=$(detect_distro)

    case $distro in
        ubuntu|debian|pop|mint|elementary)
            install_debian
            ;;
        fedora)
            install_fedora
            ;;
        *)
            print_error "Unsupported distribution: $distro"
            echo
            print_status "Please install the following packages manually:"
            echo "  • tesseract-ocr (or tesseract)"
            echo "  • xclip"
            echo "  • gnome-screenshot"
            if [ "$INSTALL_TAMIL" = "yes" ]; then
                echo "  • tesseract-ocr-tam (Tamil language pack)"
            fi
            exit 1
            ;;
    esac

    echo
    verify_installation

    if [ $? -eq 0 ]; then
        echo
        print_success "Installation completed successfully!"
        print_status "You may need to restart GNOME Shell"
        print_status "or log out and log back in for the extension to work properly."
    else
        echo
        print_error "Installation completed with errors."
        print_status "Please check the error messages above and install missing packages manually."
        exit 1
    fi
}

# Run the main function
main "$@"
