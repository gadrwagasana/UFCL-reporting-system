@echo off
:: ============================================================
:: UFCL Mobile — Generate Company Release Signing Keystore
:: Run ONCE when setting up production signing for the first time.
:: Keep the generated .jks file and the passwords SECURE.
:: ============================================================

setlocal

set KEYSTORE_FILE=..\release\ufcl-release.jks
set KEY_ALIAS=ufcl-mobile-key
set VALIDITY_DAYS=9125
set DNAME="CN=UFCL Production, OU=IT Department, O=Uganda Forestry Company Ltd, L=Kampala, ST=Central, C=UG"

:: Create release folder
if not exist "..\release" mkdir "..\release"

echo.
echo ============================================================
echo  UFCL Mobile App — Release Keystore Generator
echo ============================================================
echo.
echo This will create a signing keystore at:
echo   %KEYSTORE_FILE%
echo.
echo You will be prompted for two passwords:
echo   1. Keystore password  (protects the whole file)
echo   2. Key password       (protects this specific key)
echo.
echo USE STRONG PASSWORDS AND STORE THEM IN A SAFE PLACE.
echo If lost, you cannot update the app for existing users.
echo.
pause

:: Check Java is available
java -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Java not found. Install JDK 17 and add it to PATH.
    pause
    exit /b 1
)

keytool -genkey -v ^
  -keystore "%KEYSTORE_FILE%" ^
  -alias "%KEY_ALIAS%" ^
  -keyalg RSA ^
  -keysize 4096 ^
  -validity %VALIDITY_DAYS% ^
  -dname %DNAME%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Keystore created successfully!
    echo  File : %KEYSTORE_FILE%
    echo  Alias: %KEY_ALIAS%
    echo ============================================================
    echo.
    echo NEXT STEPS:
    echo  1. Copy release\ufcl-release.jks to a secure backup location.
    echo  2. Add the passwords to release\keystore.properties
    echo     (see template in release\keystore.properties.template)
    echo  3. NEVER commit the .jks file or keystore.properties to git.
    echo.
) else (
    echo.
    echo ERROR: Keystore generation failed.
)

pause
