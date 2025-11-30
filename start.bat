@echo off
echo ==========================================
echo    SIPADAM Fire Detection System
echo    Auto-Start Script
echo ==========================================
echo.

echo [1/2] Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python 3.7+ and add to PATH
    pause
    exit /b 1
)

echo [2/2] Starting Node.js server...
echo Python script will auto-start with the server
echo.
echo Press Ctrl+C to stop the system
echo ==========================================
echo.

node server.js

pause