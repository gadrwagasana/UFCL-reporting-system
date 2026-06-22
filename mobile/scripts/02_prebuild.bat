@echo off
:: ============================================================
:: UFCL Mobile — Expo Prebuild
:: Generates the native android/ folder from Expo managed config.
:: Run this ONCE after cloning, and again after adding new native
:: plugins or changing app.config.js native settings.
:: ============================================================

setlocal

cd /d "%~dp0.."

echo.
echo ============================================================
echo  UFCL Mobile — Expo Prebuild (generates android/ folder)
echo ============================================================
echo.
echo This will run expo prebuild for Android.
echo Existing android/ folder will be regenerated.
echo.
pause

:: Ensure dependencies installed
call npm install --legacy-peer-deps

:: Run prebuild — Android only
call npx expo prebuild --platform android --clean

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Prebuild complete!  android/ folder is ready.
    echo ============================================================
    echo.
    echo NEXT STEP: Configure signing in android/app/build.gradle
    echo See DEPLOYMENT_GUIDE.md Section 5 for instructions.
    echo.
) else (
    echo.
    echo ERROR: Prebuild failed. Check output above.
)

pause
