param(
  [ValidateSet("twitch", "kick", "youtube")]
  [string]$Platform = "twitch",
  [string]$Username = "REHANI3",
  [string]$Text = "Testing the member overlay.",
  [string]$AvatarUrl = "",
  [string]$OverlayHost = "127.0.0.1",
  [int]$OverlayPort = 8934
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$dbPath = Join-Path $projectRoot "data\overlay_history.db"

function Get-FallbackAvatarUrl {
  param(
    [string]$PlatformName,
    [string]$DatabasePath
  )

  if (-not (Test-Path $DatabasePath)) {
    return ""
  }

  @'
import sqlite3
import sys

db_path = sys.argv[1]
platform = sys.argv[2]
connection = sqlite3.connect(db_path)
cursor = connection.cursor()
queries = [
    ("SELECT avatar_url FROM messages WHERE platform = ? AND is_broadcaster = 1 AND avatar_url IS NOT NULL AND TRIM(avatar_url) <> '' ORDER BY timestamp_ms DESC, id DESC LIMIT 1", (platform,)),
    ("SELECT avatar_url FROM messages WHERE platform = ? AND avatar_url IS NOT NULL AND TRIM(avatar_url) <> '' ORDER BY timestamp_ms DESC, id DESC LIMIT 1", (platform,)),
]
for sql, params in queries:
    row = cursor.execute(sql, params).fetchone()
    if row and row[0]:
        print(row[0])
        break
connection.close()
'@ | python - $DatabasePath $PlatformName
}

if (-not $AvatarUrl) {
  $AvatarUrl = Get-FallbackAvatarUrl -PlatformName $Platform -DatabasePath $dbPath
}
$payload = @{
  platform = $Platform
  variant = "member"
  username = $Username
  text = $Text
  color = $null
  avatarUrl = $AvatarUrl
  isBroadcaster = $false
  timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  badges = @("Member")
  memberLabel = ""
  messageId = ""
}

$uri = "http://$OverlayHost`:$OverlayPort/api/history"
Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 5) | Out-Null

Write-Host ""
Write-Host "Injected test member message."
Write-Host "Platform : $Platform"
Write-Host "Username : $Username"
Write-Host "Text     : $Text"
if ($AvatarUrl) {
  Write-Host "Avatar   : $AvatarUrl"
} else {
  Write-Host "Avatar   : fallback initials will be used"
}
Write-Host ""
Write-Host "If the overlay is already open, it should appear within a few seconds."
