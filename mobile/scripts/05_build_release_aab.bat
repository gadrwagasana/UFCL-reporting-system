@echo off
:: ============================================================
:: UFCL Mobile — Build RELEASE AAB (Android App Bundle)
:: For future Play Store submission or enterprise MDM distribution.
:: Requires: release\keystore.properties to exist with real values.
:: ============================================================

setlocal

cd /d "%~dp0.."

if not exist android (
    echo ERROR: android/ folder not found. Run 02_prebuild.bat first.
    pause
    exit /b 1
)

if not exist release\keystore.properties (
    echo ERROR: release\keystore.properties not found.
    pause
    exit /b 1
)

for /f "tokens=1,2 delims==" %%a in (release\keystore.properties) do (
    if "%%a"=="KEYSTORE_FILE"     set KEYSTORE_FILE=%%b
    if "%%a"=="KEY_ALIAS"         set KEY_ALIAS=%%b
    if "%%a"=="KEYSTORE_PASSWORD" set KEYSTORE_PASSWORD=%%b
    if "%%a"=="KEY_PASSWORD"      set KEY_PASSWORD=%%b
)

echo.
echo ============================================================
echo  Building RELEASE AAB  [Production environment]
echo ============================================================
echo.

set APP_ENV=production

cd android
call gradlew.bat bundleRelease ^
  -PKEYSTORE_FILE="%CD%\..\%KEYSTORE_FILE%" ^
  -PKEY_ALIAS=%KEY_ALIAS% ^
  -PKEYSTORE_PASSWORD=%KEYSTORE_PASSWORD% ^
  -PKEY_PASSWORD=%KEY_PASSWORD%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Release AAB built successfully!
    echo  Output: android\app\build\outputs\bundle\release\app-release.aab
    echo ============================================================
) else (
    echo.
    echo ERROR: Build failed. Check output above.
)

pause
