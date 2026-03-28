$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$taskName = "StreamerBotChatOverlay"
$startScript = Join-Path $scriptDir "start-overlay.ps1"
$command = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$startupFolder = [Environment]::GetFolderPath("Startup")
$startupLauncher = Join-Path $startupFolder "StreamerBotChatOverlay.bat"

$installedViaTask = $false

try {
  $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $command"
  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
  $triggerStartup = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($triggerLogon, $triggerStartup) -Principal $principal -Settings $settings -Force -ErrorAction Stop | Out-Null
  Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
  $installedViaTask = $true
  Write-Host "Installed scheduled task: $taskName"
} catch {
  $launcherContent = "@echo off`r`npowershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`"`r`n"
  [System.IO.File]::WriteAllText($startupLauncher, $launcherContent, (New-Object System.Text.UTF8Encoding($false)))
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $startScript) -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
  Write-Host "Scheduled task install failed, so a Startup launcher was created instead:"
  Write-Host $startupLauncher
}

if ($installedViaTask -and (Test-Path $startupLauncher)) {
  Remove-Item $startupLauncher -Force -ErrorAction SilentlyContinue
}
