@echo off
:: ============================================================
:: UFCL Mobile — Build Debug APK (for testing / QA)
:: No signing required. Install directly for testers.
:: ============================================================

setlocal

cd /d "%~dp0.."

if not exist android (
    echo ERROR: android/ folder not found. Run 02_prebuild.bat first.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Building DEBUG APK  [Development environment]
echo ============================================================
echo.

set APP_ENV=development

cd android
call gradlew.bat assembleDebug

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Debug APK built successfully!
    echo  Output: android\app\build\outputs\apk\debug\app-debug.apk
    echo ============================================================
    echo.
    echo Copy app-debug.apk to your Android phone and install.
    echo  (Enable "Install unknown apps" in Android Settings)
    echo.
) else (
    echo.
    echo ERROR: Build failed. Check output above.
)

pause
