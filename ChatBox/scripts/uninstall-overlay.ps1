$taskName = "StreamerBotChatOverlay"

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
  Write-Host "Removed scheduled task: $taskName"
} catch {
  Write-Host "Scheduled task not found: $taskName"
}

$servers = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'python.exe' -and $_.CommandLine -match 'history_server\.py'
}

foreach ($proc in $servers) {
  Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Host "Stopped overlay server processes."
