#!/bin/bash

echo "=========================================="
echo "   SIPADAM Fire Detection System"
echo "   Auto-Start Script with venv"
echo "=========================================="
echo ""

# Fungsi untuk memilih venv
select_venv() {
    echo "Pilih Python virtual environment:"
    echo "1) Python 3.10 (py310)"
    echo "2) Python 3.13 (py313)"
    echo "3) Python 3.14 (py314)"
    echo ""
    read -p "Pilihan [1-3]: " choice
    
    case $choice in
        1)
            VENV_PATH="$HOME/venvs/py310"
            VENV_NAME="py310"
            ;;
        2)
            VENV_PATH="$HOME/venvs/py313"
            VENV_NAME="py313"
            ;;
        3)
            VENV_PATH="$HOME/venvs/py314"
            VENV_NAME="py314"
            ;;
        *)
            echo "❌ Pilihan tidak valid!"
            exit 1
            ;;
    esac
}

# Pilih venv
select_venv

echo ""
echo "[1/3] Activating Python virtual environment..."

if [ ! -d "$VENV_PATH" ]; then
    echo "❌ ERROR: Virtual environment not found at $VENV_PATH"
    echo "Please create venv first with:"
    echo "  python -m venv $VENV_PATH"
    exit 1
fi

source "$VENV_PATH/bin/activate"

if [ $? -eq 0 ]; then
    echo "✅ Virtual environment activated: $VENV_NAME"
else
    echo "❌ Failed to activate virtual environment"
    exit 1
fi

echo ""

echo "[2/3] Checking Python installation..."
python --version
echo ""

echo "[3/3] Starting Node.js server..."
echo "Python script will auto-start with the server"
echo ""
echo "Press Ctrl+C to stop the system"
echo "=========================================="
echo ""

node server.js

# Deactivate venv after server stops
echo ""
echo "Deactivating virtual environment..."
deactivate
echo "✅ System stopped"