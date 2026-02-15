@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ------------------------------------------------------------
rem Bullet Punjabi Runtime Installer
rem Fresh-PC safe: no Python/Git required.
rem Uses built-in PowerShell + selective file download from GitHub.
rem ------------------------------------------------------------

set "GITHUB_OWNER=reehaani"
set "GITHUB_REPO=Bullet-Punjabi-Overlays"
set "GITHUB_BRANCH=master"
set "TARGET_DIR=%cd%\BulletPunjabi-Runtime"
set "TEMP_DIR=%TEMP%\bp_runtime_install_%RANDOM%_%RANDOM%"

echo.
echo ============================================
  echo   Bullet Punjabi Runtime Installer
echo ============================================
echo Source: https://github.com/%GITHUB_OWNER%/%GITHUB_REPO% (%GITHUB_BRANCH%)
echo Target: %TARGET_DIR%
echo.

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell was not found on this system.
  echo This installer needs built-in Windows PowerShell to continue.
  exit /b 1
)

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

call :InstallSelective
if errorlevel 1 goto :Fail
goto :Done

:InstallSelective
set "PS_SCRIPT=%TEMP_DIR%\install_runtime_selective.ps1"
> "%PS_SCRIPT%" echo $Owner = '%GITHUB_OWNER%'
>> "%PS_SCRIPT%" echo $Repo = '%GITHUB_REPO%'
>> "%PS_SCRIPT%" echo $Branch = '%GITHUB_BRANCH%'
>> "%PS_SCRIPT%" echo $TargetDir = '%TARGET_DIR%'
>> "%PS_SCRIPT%" echo $ErrorActionPreference = 'Stop'
>> "%PS_SCRIPT%" echo [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
>> "%PS_SCRIPT%" echo $headers = @{ 'User-Agent' = 'BulletPunjabiInstaller' }
>> "%PS_SCRIPT%" echo function Get-RepoFiles([string]$Path) {
>> "%PS_SCRIPT%" echo   $encodedApiPath = (($Path -split '/') ^| ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
>> "%PS_SCRIPT%" echo   $apiUrl = "https://api.github.com/repos/$Owner/$Repo/contents/$encodedApiPath?ref=${Branch}"
>> "%PS_SCRIPT%" echo   Write-Host ("Scanning: " ^+ $apiUrl)
>> "%PS_SCRIPT%" echo   $items = Invoke-RestMethod -Headers $headers -Uri $apiUrl
>> "%PS_SCRIPT%" echo   $result = @()
>> "%PS_SCRIPT%" echo   foreach ($item in $items) {
>> "%PS_SCRIPT%" echo     if ($item.type -eq 'file') { $result += $item.path }
>> "%PS_SCRIPT%" echo     elseif ($item.type -eq 'dir') { $result += Get-RepoFiles -Path $item.path }
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   return $result
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $files = @()
>> "%PS_SCRIPT%" echo foreach ($root in @('Overlays','Data','Settings','Logo','Streamer Bot')) { $files += Get-RepoFiles -Path $root }
>> "%PS_SCRIPT%" echo $requiredTopFiles = @('ColorControllerNew.exe')
>> "%PS_SCRIPT%" echo $optionalTopFiles = @('HueActionNew.exe','Run Color Controller.bat')
>> "%PS_SCRIPT%" echo $files += $requiredTopFiles + $optionalTopFiles
>> "%PS_SCRIPT%" echo if (-not $files -or $files.Count -eq 0) { throw "No runtime files matched." }
>> "%PS_SCRIPT%" echo foreach ($path in $files) {
>> "%PS_SCRIPT%" echo   $dest = Join-Path $TargetDir $path
>> "%PS_SCRIPT%" echo   $destDir = Split-Path -Parent $dest
>> "%PS_SCRIPT%" echo   if ($destDir -and -not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force ^| Out-Null }
>> "%PS_SCRIPT%" echo   $encodedPath = (($path -split '/') ^| ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
>> "%PS_SCRIPT%" echo   $rawUrl = "https://raw.githubusercontent.com/$Owner/$Repo/$Branch/$encodedPath"
>> "%PS_SCRIPT%" echo   $isOptional = ($optionalTopFiles -contains $path)
>> "%PS_SCRIPT%" echo   try { Invoke-WebRequest -Headers $headers -Uri $rawUrl -OutFile $dest } catch { if (-not $isOptional) { throw } }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $required = @('Overlays','Data','Settings','Logo','Streamer Bot','ColorControllerNew.exe')
>> "%PS_SCRIPT%" echo foreach ($r in $required) {
>> "%PS_SCRIPT%" echo   $full = Join-Path $TargetDir $r
>> "%PS_SCRIPT%" echo   if (-not (Test-Path $full)) { throw "Missing required runtime item: $r" }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo Write-Host ("Downloaded runtime files: " ^+ $files.Count)

echo Downloading selected runtime files...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
if errorlevel 1 exit /b 1

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
echo - Streamer Bot\
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
