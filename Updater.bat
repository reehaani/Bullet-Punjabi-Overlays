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
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "TARGET_DIR=%SCRIPT_DIR%\BulletPunjabi-Runtime"
set "TEMP_DIR=%TEMP%\bp_runtime_install_%RANDOM%_%RANDOM%"

echo.
echo ============================================
  echo   Bullet Punjabi Runtime Installer
echo ============================================
echo Source: https://github.com/%GITHUB_OWNER%/%GITHUB_REPO% (%GITHUB_BRANCH%)
echo Target: %TARGET_DIR%
echo.

if /I "%TARGET_DIR%"=="%SCRIPT_DIR%" (
  echo ERROR: Refusing to install into repository root.
  echo Target must be a dedicated runtime folder.
  exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell was not found on this system.
  echo This installer needs built-in Windows PowerShell to continue.
  exit /b 1
)

if exist "%TARGET_DIR%" (
  echo Target folder already exists.
  set /p _overwrite="Update existing runtime folder in-place? (Y/N): "
  for /f "tokens=* delims= " %%A in ("!_overwrite!") do set "_overwrite=%%~A"
  if /I "!_overwrite:~0,1!"=="Y" (
    set "_overwrite=Y"
  ) else (
    echo Cancelled.
    pause
    exit /b 1
  )
)

if not exist "%TARGET_DIR%" (
  mkdir "%TARGET_DIR%" >nul 2>&1
  if errorlevel 1 (
    echo Failed to create target directory.
    exit /b 1
  )
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
>> "%PS_SCRIPT%" echo $preserveFiles = @(
>> "%PS_SCRIPT%" echo   'Settings/settings.js',
>> "%PS_SCRIPT%" echo   'Data/data_chatters.js',
>> "%PS_SCRIPT%" echo   'Data/data_followers.js',
>> "%PS_SCRIPT%" echo   'Data/data_kicks.js',
>> "%PS_SCRIPT%" echo   'Data/data_tips.js'
>> "%PS_SCRIPT%" echo )
>> "%PS_SCRIPT%" echo $excludeFiles = @(
>> "%PS_SCRIPT%" echo   'Settings/install-sync-report.txt'
>> "%PS_SCRIPT%" echo )
>> "%PS_SCRIPT%" echo $preservedBytes = @{}
>> "%PS_SCRIPT%" echo $reportPath = Join-Path $TargetDir 'Settings/install-sync-report.txt'
>> "%PS_SCRIPT%" echo $stats = [ordered]@{ Planned = 0; Added = 0; Updated = 0; Unchanged = 0; Preserved = 0; LockedSkipped = 0; OptionalSkipped = 0; Verified = 0; VerifyMismatch = 0 }
>> "%PS_SCRIPT%" echo $skipVerify = @{}
>> "%PS_SCRIPT%" echo $remoteHashes = @{}
>> "%PS_SCRIPT%" echo $mismatchFiles = New-Object System.Collections.Generic.List[string]
>> "%PS_SCRIPT%" echo $lockedSkippedFiles = New-Object System.Collections.Generic.List[string]
>> "%PS_SCRIPT%" echo $optionalSkippedFiles = New-Object System.Collections.Generic.List[string]
>> "%PS_SCRIPT%" echo foreach ($rel in $preserveFiles) {
>> "%PS_SCRIPT%" echo   $full = Join-Path $TargetDir $rel
>> "%PS_SCRIPT%" echo   if (Test-Path $full) { $preservedBytes[$rel] = [System.IO.File]::ReadAllBytes($full) }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo function Get-RepoFiles([string]$Path) {
>> "%PS_SCRIPT%" echo   $encodedApiPath = (($Path -split '/') ^| ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
>> "%PS_SCRIPT%" echo   $apiUrl = "https://api.github.com/repos/$Owner/$Repo/contents/${encodedApiPath}?ref=${Branch}"
>> "%PS_SCRIPT%" echo   Write-Host ("Scanning: " ^+ $apiUrl)
>> "%PS_SCRIPT%" echo   $items = Invoke-RestMethod -Headers $headers -Uri $apiUrl
>> "%PS_SCRIPT%" echo   $result = @()
>> "%PS_SCRIPT%" echo   foreach ($item in $items) {
>> "%PS_SCRIPT%" echo     if ($item.type -eq 'file') { $result += $item.path }
>> "%PS_SCRIPT%" echo     elseif ($item.type -eq 'dir') { $result += Get-RepoFiles -Path $item.path }
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   return $result
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo function Get-HashSafe([string]$Path) {
>> "%PS_SCRIPT%" echo   if (Test-Path $Path) { return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash }
>> "%PS_SCRIPT%" echo   return $null
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $files = @()
>> "%PS_SCRIPT%" echo foreach ($root in @('Overlays','Data','Settings','Logo','Streamer Bot','Scripts')) { $files += Get-RepoFiles -Path $root }
>> "%PS_SCRIPT%" echo $requiredTopFiles = @('ColorControllerNew.exe')
>> "%PS_SCRIPT%" echo $optionalTopFiles = @('HueActionNew.exe','Run Color Controller.bat')
>> "%PS_SCRIPT%" echo $files += $requiredTopFiles + $optionalTopFiles
>> "%PS_SCRIPT%" echo $files = $files ^| Sort-Object -Unique
>> "%PS_SCRIPT%" echo $files = $files ^| Where-Object { $excludeFiles -notcontains $_ }
>> "%PS_SCRIPT%" echo if (-not $files -or $files.Count -eq 0) { throw "No runtime files matched." }
>> "%PS_SCRIPT%" echo $stats.Planned = $files.Count
>> "%PS_SCRIPT%" echo foreach ($path in $files) {
>> "%PS_SCRIPT%" echo   $dest = Join-Path $TargetDir $path
>> "%PS_SCRIPT%" echo   $destDir = Split-Path -Parent $dest
>> "%PS_SCRIPT%" echo   if ($destDir -and -not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force ^| Out-Null }
>> "%PS_SCRIPT%" echo   $encodedPath = (($path -split '/') ^| ForEach-Object { [uri]::EscapeDataString($_) }) -join '/'
>> "%PS_SCRIPT%" echo   $rawUrl = "https://raw.githubusercontent.com/$Owner/$Repo/$Branch/$encodedPath"
>> "%PS_SCRIPT%" echo   $isOptional = ($optionalTopFiles -contains $path)
>> "%PS_SCRIPT%" echo   $isUpdatableExe = ($path -ieq 'ColorControllerNew.exe' -or $path -ieq 'HueActionNew.exe')
>> "%PS_SCRIPT%" echo   $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('bp_runtime_' + [guid]::NewGuid().ToString('N') + '.tmp')
>> "%PS_SCRIPT%" echo   try {
>> "%PS_SCRIPT%" echo     Invoke-WebRequest -Headers $headers -Uri $rawUrl -OutFile $tmp
>> "%PS_SCRIPT%" echo   } catch {
>> "%PS_SCRIPT%" echo     if ($isOptional) {
>> "%PS_SCRIPT%" echo       $stats.OptionalSkipped++
>> "%PS_SCRIPT%" echo       $optionalSkippedFiles.Add($path) ^| Out-Null
>> "%PS_SCRIPT%" echo       $skipVerify[$path] = $true
>> "%PS_SCRIPT%" echo       continue
>> "%PS_SCRIPT%" echo     } else {
>> "%PS_SCRIPT%" echo       throw
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   $newHash = Get-HashSafe -Path $tmp
>> "%PS_SCRIPT%" echo   $remoteHashes[$path] = $newHash
>> "%PS_SCRIPT%" echo   $existsBefore = Test-Path $dest
>> "%PS_SCRIPT%" echo   $oldHash = if ($existsBefore) { Get-HashSafe -Path $dest } else { $null }
>> "%PS_SCRIPT%" echo   if ($existsBefore -and $oldHash -eq $newHash) {
>> "%PS_SCRIPT%" echo     Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo     $stats.Unchanged++
>> "%PS_SCRIPT%" echo     continue
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   if ($isUpdatableExe) {
>> "%PS_SCRIPT%" echo     $procName = [System.IO.Path]::GetFileNameWithoutExtension($path)
>> "%PS_SCRIPT%" echo     $procs = @(Get-Process -Name $procName -ErrorAction SilentlyContinue)
>> "%PS_SCRIPT%" echo     if ($procs.Count -gt 0) {
>> "%PS_SCRIPT%" echo       Write-Host ('Closing running process before update: ' + $procName)
>> "%PS_SCRIPT%" echo       foreach ($p in $procs) { try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch {} }
>> "%PS_SCRIPT%" echo       Start-Sleep -Milliseconds 700
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   try {
>> "%PS_SCRIPT%" echo     [System.IO.File]::Copy($tmp, $dest, $true)
>> "%PS_SCRIPT%" echo     Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo   } catch {
>> "%PS_SCRIPT%" echo     $copyError = $_
>> "%PS_SCRIPT%" echo     $msg = if ($copyError.Exception) { $copyError.Exception.Message } else { '' }
>> "%PS_SCRIPT%" echo     $isLockError = ($msg -match 'being used by another process' -or $msg -match 'access is denied' -or $msg -match 'The file exists')
>> "%PS_SCRIPT%" echo     if ($isLockError -and $isUpdatableExe) {
>> "%PS_SCRIPT%" echo       $procName = [System.IO.Path]::GetFileNameWithoutExtension($path)
>> "%PS_SCRIPT%" echo       $procs = @(Get-Process -Name $procName -ErrorAction SilentlyContinue)
>> "%PS_SCRIPT%" echo       if ($procs.Count -gt 0) {
>> "%PS_SCRIPT%" echo         Write-Warning ('Retrying after closing process: ' + $procName)
>> "%PS_SCRIPT%" echo         foreach ($p in $procs) { try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch {} }
>> "%PS_SCRIPT%" echo         Start-Sleep -Milliseconds 900
>> "%PS_SCRIPT%" echo       }
>> "%PS_SCRIPT%" echo       try {
>> "%PS_SCRIPT%" echo         [System.IO.File]::Copy($tmp, $dest, $true)
>> "%PS_SCRIPT%" echo         Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo       } catch {
>> "%PS_SCRIPT%" echo         Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo       Write-Warning ("Skipped locked file: " ^+ $path ^+ " (close it and re-run to update this EXE).")
>> "%PS_SCRIPT%" echo       $stats.LockedSkipped++
>> "%PS_SCRIPT%" echo       $lockedSkippedFiles.Add($path) ^| Out-Null
>> "%PS_SCRIPT%" echo       $skipVerify[$path] = $true
>> "%PS_SCRIPT%" echo       continue
>> "%PS_SCRIPT%" echo       }
>> "%PS_SCRIPT%" echo     } elseif ($isOptional) {
>> "%PS_SCRIPT%" echo       Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo       $stats.OptionalSkipped++
>> "%PS_SCRIPT%" echo       $optionalSkippedFiles.Add($path) ^| Out-Null
>> "%PS_SCRIPT%" echo       $skipVerify[$path] = $true
>> "%PS_SCRIPT%" echo       continue
>> "%PS_SCRIPT%" echo     } else {
>> "%PS_SCRIPT%" echo       Remove-Item -Path $tmp -Force -ErrorAction SilentlyContinue
>> "%PS_SCRIPT%" echo       throw $copyError
>> "%PS_SCRIPT%" echo     }
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   if ($existsBefore) { $stats.Updated++ } else { $stats.Added++ }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo foreach ($rel in $preservedBytes.Keys) {
>> "%PS_SCRIPT%" echo   $full = Join-Path $TargetDir $rel
>> "%PS_SCRIPT%" echo   $dir = Split-Path -Parent $full
>> "%PS_SCRIPT%" echo   if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force ^| Out-Null }
>> "%PS_SCRIPT%" echo   [System.IO.File]::WriteAllBytes($full, $preservedBytes[$rel])
>> "%PS_SCRIPT%" echo   $stats.Preserved++
>> "%PS_SCRIPT%" echo   $skipVerify[$rel] = $true
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $required = @('Overlays','Data','Settings','Logo','Streamer Bot','Scripts','ColorControllerNew.exe')
>> "%PS_SCRIPT%" echo foreach ($r in $required) {
>> "%PS_SCRIPT%" echo   $full = Join-Path $TargetDir $r
>> "%PS_SCRIPT%" echo   if (-not (Test-Path $full)) { throw "Missing required runtime item: $r" }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo foreach ($path in $remoteHashes.Keys) {
>> "%PS_SCRIPT%" echo   if ($skipVerify.ContainsKey($path)) { continue }
>> "%PS_SCRIPT%" echo   $dest = Join-Path $TargetDir $path
>> "%PS_SCRIPT%" echo   if (-not (Test-Path $dest)) {
>> "%PS_SCRIPT%" echo     $stats.VerifyMismatch++
>> "%PS_SCRIPT%" echo     $mismatchFiles.Add($path) ^| Out-Null
>> "%PS_SCRIPT%" echo     continue
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo   $localHash = Get-HashSafe -Path $dest
>> "%PS_SCRIPT%" echo   if ($localHash -eq $remoteHashes[$path]) {
>> "%PS_SCRIPT%" echo     $stats.Verified++
>> "%PS_SCRIPT%" echo   } else {
>> "%PS_SCRIPT%" echo     $stats.VerifyMismatch++
>> "%PS_SCRIPT%" echo     $mismatchFiles.Add($path) ^| Out-Null
>> "%PS_SCRIPT%" echo   }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $syncStatus = if ($stats.VerifyMismatch -eq 0) { 'IN SYNC' } else { 'OUT OF SYNC' }
>> "%PS_SCRIPT%" echo $reportLines = @(
>> "%PS_SCRIPT%" echo   'Bullet Punjabi Runtime Sync Report',
>> "%PS_SCRIPT%" echo   ('Repository              : ' + $Owner + '/' + $Repo + ' @ ' + $Branch),
>> "%PS_SCRIPT%" echo   ('Target                  : ' + $TargetDir),
>> "%PS_SCRIPT%" echo   ('Planned files           : ' + $stats.Planned),
>> "%PS_SCRIPT%" echo   ('Added                   : ' + $stats.Added),
>> "%PS_SCRIPT%" echo   ('Updated/Replaced        : ' + $stats.Updated),
>> "%PS_SCRIPT%" echo   ('Unchanged               : ' + $stats.Unchanged),
>> "%PS_SCRIPT%" echo   ('Preserved local files   : ' + $stats.Preserved),
>> "%PS_SCRIPT%" echo   ('Locked skipped          : ' + $stats.LockedSkipped),
>> "%PS_SCRIPT%" echo   ('Optional skipped        : ' + $stats.OptionalSkipped),
>> "%PS_SCRIPT%" echo   ('Verified in sync        : ' + $stats.Verified),
>> "%PS_SCRIPT%" echo   ('Verification mismatches : ' + $stats.VerifyMismatch),
>> "%PS_SCRIPT%" echo   ('Sync status             : ' + $syncStatus)
>> "%PS_SCRIPT%" echo )
>> "%PS_SCRIPT%" echo if ($mismatchFiles.Count -gt 0) {
>> "%PS_SCRIPT%" echo   $reportLines += ''
>> "%PS_SCRIPT%" echo   $reportLines += 'Mismatched files:'
>> "%PS_SCRIPT%" echo   foreach ($p in $mismatchFiles) { $reportLines += ('- ' + $p) }
>> "%PS_SCRIPT%" echo }
>> "%PS_SCRIPT%" echo $reportDir = Split-Path -Parent $reportPath
>> "%PS_SCRIPT%" echo if ($reportDir -and -not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force ^| Out-Null }
>> "%PS_SCRIPT%" echo Set-Content -Path $reportPath -Value $reportLines -Encoding UTF8
>> "%PS_SCRIPT%" echo Write-Host ''
>> "%PS_SCRIPT%" echo Write-Host '=== Runtime Sync Checklist ==='
>> "%PS_SCRIPT%" echo Write-Host ('Planned files            : ' + $stats.Planned)
>> "%PS_SCRIPT%" echo Write-Host ('Added (new)              : ' + $stats.Added)
>> "%PS_SCRIPT%" echo Write-Host ('Updated/Replaced         : ' + $stats.Updated)
>> "%PS_SCRIPT%" echo Write-Host ('Unchanged                : ' + $stats.Unchanged)
>> "%PS_SCRIPT%" echo Write-Host ('Preserved local files    : ' + $stats.Preserved)
>> "%PS_SCRIPT%" echo Write-Host ('Locked skipped           : ' + $stats.LockedSkipped)
>> "%PS_SCRIPT%" echo Write-Host ('Optional skipped         : ' + $stats.OptionalSkipped)
>> "%PS_SCRIPT%" echo Write-Host ('Verified in sync         : ' + $stats.Verified)
>> "%PS_SCRIPT%" echo Write-Host ('Verification mismatches  : ' + $stats.VerifyMismatch)
>> "%PS_SCRIPT%" echo Write-Host ('Sync status              : ' + $syncStatus)
>> "%PS_SCRIPT%" echo Write-Host ('Report file              : ' + $reportPath)
>> "%PS_SCRIPT%" echo if ($lockedSkippedFiles.Count -gt 0) { Write-Warning ('Locked files skipped: ' + ($lockedSkippedFiles -join ', ')) }
>> "%PS_SCRIPT%" echo if ($optionalSkippedFiles.Count -gt 0) { Write-Warning ('Optional files skipped: ' + ($optionalSkippedFiles -join ', ')) }
>> "%PS_SCRIPT%" echo if ($mismatchFiles.Count -gt 0) {
>> "%PS_SCRIPT%" echo   Write-Host 'Out-of-sync files:'
>> "%PS_SCRIPT%" echo   foreach ($p in $mismatchFiles) { Write-Host (' - ' + $p) }
>> "%PS_SCRIPT%" echo   throw ('Runtime verification failed. See report: ' + $reportPath)
>> "%PS_SCRIPT%" echo }

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
echo - Scripts\
echo - ColorControllerNew.exe
echo - HueActionNew.exe
echo - Run Color Controller.bat

rmdir /s /q "%TEMP_DIR%" >nul 2>&1
pause
exit /b 0

:Fail
echo.
echo Installation failed.
rmdir /s /q "%TEMP_DIR%" >nul 2>&1
pause
exit /b 1
