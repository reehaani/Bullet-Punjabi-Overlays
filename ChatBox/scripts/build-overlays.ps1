param()

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

$indexPath = Join-Path $projectRoot "index.html"
$stylesPath = Join-Path $projectRoot "styles.css"
$appPath = Join-Path $projectRoot "app.js"
$standalonePath = Join-Path $projectRoot "standalone.html"
$streamPath = Join-Path $projectRoot "stream-overlay.html"
$dockPath = Join-Path $projectRoot "dock-overlay.html"
$trainPath = Join-Path $projectRoot "train-overlay.html"

$index = Get-Content -Path $indexPath -Raw -Encoding UTF8
$styles = Get-Content -Path $stylesPath -Raw -Encoding UTF8
$app = Get-Content -Path $appPath -Raw -Encoding UTF8

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

$standalone = $index `
  -replace '<link rel="stylesheet" href="\./styles\.css">\s*', "<style>`r`n$styles`r`n</style>`r`n" `
  -replace '<script src="\./app\.js"></script>', "<script>`r`n$app`r`n</script>"

Write-Utf8NoBom -Path $standalonePath -Content $standalone

function New-BootScript([hashtable]$Config) {
  $json = $Config | ConvertTo-Json -Compress -Depth 8
  return "<script>`r`nwindow.__OVERLAY_BOOT_CONFIG__ = $json;`r`n</script>`r`n"
}

$streamBoot = New-BootScript @{
  host = "127.0.0.1"
  port = 8080
  staleAfterSec = 180
  maxMessages = 0
  enabledPlatforms = @("twitch", "kick", "youtube", "streamlabs", "streamelements")
  ignoreUsers = @("StreamElements", "Streamlabs")
  ignoreBangCommands = $true
  showStatus = $false
  backgroundColor = "#000000"
  backgroundOpacity = 0
  hideDeletedMessages = $true
  localOnly = $true
  showModerationControls = $false
}

$dockBoot = New-BootScript @{
  host = "127.0.0.1"
  port = 8080
  staleAfterSec = 180
  maxMessages = 0
  enabledPlatforms = @("twitch", "kick", "youtube", "streamlabs", "streamelements")
  fontSize = 22
  usernameFontSize = 21
  memberNameFontSize = 23
  supporterNameFontSize = 24
  timeFontSize = 14
  showStatus = $true
  backgroundColor = "#000000"
  backgroundOpacity = 1
  hideDeletedMessages = $false
  localOnly = $true
  showModerationControls = $true
  moderationDeleteAction = "Overlay Mod - Delete Message"
  moderationPinAction = "Overlay Mod - Pin Message"
  moderationTimeoutAction = "Overlay Mod - Timeout User"
  moderationBanAction = "Overlay Mod - Ban User"
  moderationTimeoutSeconds = 600
}

$trainBoot = New-BootScript @{
  host = "127.0.0.1"
  port = 8080
  staleAfterSec = 180
  maxMessages = 0
  enabledPlatforms = @("twitch", "kick", "youtube", "streamlabs", "streamelements")
  showStatus = $false
  backgroundColor = "#000000"
  backgroundOpacity = 0
  hideDeletedMessages = $true
  localOnly = $false
  showModerationControls = $false
  trainOnly = $true
  trainPosition = "bottom-left"
  trainWidth = 860
  trainScale = 1
  trainCompact = $false
}

$streamHtml = $standalone -replace '(?s)(</head>)', "$streamBoot`$1"
$dockHtml = $standalone -replace '(?s)(</head>)', "$dockBoot`$1"
$trainHtml = $standalone -replace '(?s)(</head>)', "$trainBoot`$1"

Write-Utf8NoBom -Path $streamPath -Content $streamHtml
Write-Utf8NoBom -Path $dockPath -Content $dockHtml
Write-Utf8NoBom -Path $trainPath -Content $trainHtml

Write-Host "Built:"
Write-Host " - $standalonePath"
Write-Host " - $streamPath"
Write-Host " - $dockPath"
Write-Host " - $trainPath"
