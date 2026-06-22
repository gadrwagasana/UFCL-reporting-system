@echo off
:: ============================================================
:: UFCL Mobile — Build RELEASE APK (for direct installation)
:: Signed with the company keystore. Distribute via USB / LAN.
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
    echo Copy release\keystore.properties.template to release\keystore.properties
    echo and fill in your keystore passwords.
    pause
    exit /b 1
)

:: Load keystore properties
for /f "tokens=1,2 delims==" %%a in (release\keystore.properties) do (
    if "%%a"=="KEYSTORE_FILE"     set KEYSTORE_FILE=%%b
    if "%%a"=="KEY_ALIAS"         set KEY_ALIAS=%%b
    if "%%a"=="KEYSTORE_PASSWORD" set KEYSTORE_PASSWORD=%%b
    if "%%a"=="KEY_PASSWORD"      set KEY_PASSWORD=%%b
)

echo.
echo ============================================================
echo  Building RELEASE APK  [Production environment]
echo ============================================================
echo.
echo Keystore : %KEYSTORE_FILE%
echo Key alias: %KEY_ALIAS%
echo.

set APP_ENV=production

cd android
call gradlew.bat assembleRelease ^
  -PKEYSTORE_FILE="%CD%\..\%KEYSTORE_FILE%" ^
  -PKEY_ALIAS=%KEY_ALIAS% ^
  -PKEYSTORE_PASSWORD=%KEYSTORE_PASSWORD% ^
  -PKEY_PASSWORD=%KEY_PASSWORD%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Release APK built successfully!
    echo  Output: android\app\build\outputs\apk\release\app-release.apk
    echo ============================================================
    echo.
    echo Distribute this APK to company phones via USB or internal file share.
    echo.
) else (
    echo.
    echo ERROR: Build failed. Check output above.
)

pause
