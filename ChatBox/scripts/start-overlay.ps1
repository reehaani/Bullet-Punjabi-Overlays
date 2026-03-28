param(
  [string]$HostName = "127.0.0.1",
  [int]$Port = 8080,
  [string]$OverlayBindAddress = "127.0.0.1",
  [int]$OverlayPort = 8934,
  [string]$Password = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$serverScript = Join-Path $scriptDir "history_server.py"
$buildScript = Join-Path $scriptDir "build-overlays.ps1"
$pythonExe = (Get-Command python -ErrorAction Stop).Source

if (Test-Path $buildScript) {
  powershell -NoProfile -ExecutionPolicy Bypass -File $buildScript | Out-Null
}

$existing = @(
  Get-CimInstance Win32_Process | Where-Object {
    $_.Name -like 'python*' -and $_.CommandLine -match 'history_server\.py'
  }
)
foreach ($proc in $existing) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Process -FilePath $pythonExe -ArgumentList @($serverScript, $OverlayBindAddress, $OverlayPort) -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 2

$standaloneUrl = "http://127.0.0.1:$OverlayPort/standalone.html?host=$HostName&port=$Port&staleAfterSec=180&maxMessages=0&platforms=twitch,kick,youtube,streamlabs,streamelements"
$streamUrl = "http://127.0.0.1:$OverlayPort/stream-overlay.html?host=$HostName&port=$Port&staleAfterSec=180&maxMessages=0&platforms=twitch,kick,youtube,streamlabs,streamelements"
$dockUrl = "http://127.0.0.1:$OverlayPort/dock-overlay.html?host=$HostName&port=$Port&staleAfterSec=180&maxMessages=0&platforms=twitch,kick,youtube,streamlabs,streamelements&showModerationControls=true"
$trainUrl = "http://127.0.0.1:$OverlayPort/train-overlay.html?host=$HostName&port=$Port&staleAfterSec=180&maxMessages=0&platforms=twitch,kick,youtube,streamlabs,streamelements"
if ($Password) {
  $encoded = [uri]::EscapeDataString($Password)
  $standaloneUrl += "&password=$encoded"
  $streamUrl += "&password=$encoded"
  $dockUrl += "&password=$encoded"
  $trainUrl += "&password=$encoded"
}

Write-Host ""
Write-Host "Standalone URL:"
Write-Host $standaloneUrl
Write-Host ""
Write-Host "Stream URL:"
Write-Host $streamUrl
Write-Host ""
Write-Host "Dock URL:"
Write-Host $dockUrl
Write-Host ""
Write-Host "Train Overlay URL:"
Write-Host $trainUrl
Write-Host ""
