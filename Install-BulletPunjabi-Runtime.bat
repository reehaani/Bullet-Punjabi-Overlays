@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ------------------------------------------------------------
rem Bullet Punjabi Runtime Installer
rem Downloads only runtime-required files from GitHub.
rem ------------------------------------------------------------

set "REPO_URL=https://github.com/reehaani/Bullet-Punjabi-Overlays.git"
set "ZIP_URL=https://codeload.github.com/reehaani/Bullet-Punjabi-Overlays/zip/refs/heads/master"
set "BRANCH=master"
set "TARGET_DIR=%cd%\BulletPunjabi-Runtime"
set "TEMP_DIR=%TEMP%\bp_runtime_install_%RANDOM%_%RANDOM%"

echo.
echo ============================================
echo   Bullet Punjabi Runtime Installer
echo ============================================
echo Repo: %REPO_URL%
echo Target: %TARGET_DIR%
echo.

if exist "%TARGET_DIR%" (
  echo Target folder already exists.
  set /p _overwrite="Overwrite existing runtime folder? (Y/N): "
  if /I not "!_overwrite!"=="Y" (
    echo Cancelled.
    exit /b 1
  )
  rmdir /s /q "%TARGET_DIR%" >nul 2>&1
)

mkdir "%TARGET_DIR%" >nul 2>&1
if errorlevel 1 (
  echo Failed to create target directory.
  exit /b 1
)

mkdir "%TEMP_DIR%" >nul 2>&1
if errorlevel 1 (
  echo Failed to create temp directory.
  exit /b 1
)

where git >nul 2>&1
if not errorlevel 1 (
  echo Using git sparse checkout...
  call :InstallWithGit
  if not errorlevel 1 goto :Done
  echo Git sparse checkout failed. Falling back to ZIP download...
)

call :InstallWithZip
if errorlevel 1 goto :Fail
goto :Done

:InstallWithGit
pushd "%TEMP_DIR%" >nul
git init >nul 2>&1 || (popd & exit /b 1)
git remote add origin "%REPO_URL%" >nul 2>&1 || (popd & exit /b 1)
git config core.sparseCheckout true >nul 2>&1 || (popd & exit /b 1)
git config core.autocrlf false >nul 2>&1

(
  echo /Overlays/
  echo /Data/
  echo /Settings/
  echo /Logo/
  echo /ColorControllerNew.exe
  echo /HueActionNew.exe
  echo /Run Color Controller.bat
) > ".git\info\sparse-checkout"

git pull --depth 1 origin "%BRANCH%" >nul 2>&1 || (popd & exit /b 1)

xcopy "%TEMP_DIR%\Overlays" "%TARGET_DIR%\Overlays\" /E /I /Y >nul
xcopy "%TEMP_DIR%\Data" "%TARGET_DIR%\Data\" /E /I /Y >nul
xcopy "%TEMP_DIR%\Settings" "%TARGET_DIR%\Settings\" /E /I /Y >nul
xcopy "%TEMP_DIR%\Logo" "%TARGET_DIR%\Logo\" /E /I /Y >nul

if exist "%TEMP_DIR%\ColorControllerNew.exe" copy /Y "%TEMP_DIR%\ColorControllerNew.exe" "%TARGET_DIR%\" >nul
if exist "%TEMP_DIR%\HueActionNew.exe" copy /Y "%TEMP_DIR%\HueActionNew.exe" "%TARGET_DIR%\" >nul
if exist "%TEMP_DIR%\Run Color Controller.bat" copy /Y "%TEMP_DIR%\Run Color Controller.bat" "%TARGET_DIR%\" >nul

popd >nul
exit /b 0

:InstallWithZip
set "ZIP_FILE=%TEMP_DIR%\runtime.zip"
set "EXTRACT_DIR=%TEMP_DIR%\extract"
mkdir "%EXTRACT_DIR%" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_FILE%';" ^
  "Expand-Archive -LiteralPath '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force;" >nul 2>&1
if errorlevel 1 exit /b 1

for /d %%D in ("%EXTRACT_DIR%\*") do set "ROOT=%%~fD"
if not defined ROOT exit /b 1

xcopy "%ROOT%\Overlays" "%TARGET_DIR%\Overlays\" /E /I /Y >nul
xcopy "%ROOT%\Data" "%TARGET_DIR%\Data\" /E /I /Y >nul
xcopy "%ROOT%\Settings" "%TARGET_DIR%\Settings\" /E /I /Y >nul
xcopy "%ROOT%\Logo" "%TARGET_DIR%\Logo\" /E /I /Y >nul

if exist "%ROOT%\ColorControllerNew.exe" copy /Y "%ROOT%\ColorControllerNew.exe" "%TARGET_DIR%\" >nul
if exist "%ROOT%\HueActionNew.exe" copy /Y "%ROOT%\HueActionNew.exe" "%TARGET_DIR%\" >nul
if exist "%ROOT%\Run Color Controller.bat" copy /Y "%ROOT%\Run Color Controller.bat" "%TARGET_DIR%\" >nul

exit /b 0

:Done
echo.
echo Install completed successfully.
echo Runtime folder: %TARGET_DIR%
echo.
echo Included:
echo - Overlays\
echo - Data\
echo - Settings\
echo - Logo\
echo - ColorControllerNew.exe
echo - HueActionNew.exe
echo - Run Color Controller.bat

rmdir /s /q "%TEMP_DIR%" >nul 2>&1
exit /b 0

:Fail
echo.
echo Installation failed.
rmdir /s /q "%TEMP_DIR%" >nul 2>&1
exit /b 1

