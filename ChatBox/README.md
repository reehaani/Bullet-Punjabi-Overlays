# ChatBox

Clean folder layout:

- root: main overlays and launchers
- `assets/`: image assets
- `data/`: overlay history database
- `docs/`: reference links and notes
- `scripts/`: helper scripts and server files

## Main files you actually use

- `Run Overlay.bat`
- `Install Overlay.bat`
- `Uninstall Overlay.bat`
- `standalone.html`
- `stream-overlay.html`
- `dock-overlay.html`

## Reliable workflow

Use the server-backed setup when you want:

- shared history between views
- recovery after OBS refresh/restart
- better reliability if Streamer.bot or the browser source reconnects
- easier remote access later through Tailscale

That setup uses:

- `Run Overlay.bat`
- `standalone.html`

## Background automation setup

If you want the Python helper to run in the background automatically at startup/login:

- run `Install Overlay.bat` once
- it installs a hidden scheduled task and starts it immediately
- after that, use the server-based browser-source URLs instead of `file://` HTML files

This is the setup you want for:

- shared settings between dock and stream
- train status files for OBS automation
- shared train overlay updates
- the most reliable dock/stream/train sync

## Optional Twitch profile pictures

You can enable Twitch chatter profile pictures directly in the HTML overlay by passing:

- `twitchClientId`
- `twitchAccessToken`

Example:

`standalone.html?...&twitchClientId=YOUR_CLIENT_ID&twitchAccessToken=YOUR_ACCESS_TOKEN`

If you are using the Python server-backed setup, it can also fetch avatars with:

- `CHATBOX_TWITCH_CLIENT_ID`
- `CHATBOX_TWITCH_ACCESS_TOKEN`

## Folder notes

- `assets/` holds the LucidPay and member logo images
- `data/overlay_history.db` stores chat history
- `docs/` has the OBS URLs and extra notes
- `scripts/` contains the PowerShell and Python helpers
