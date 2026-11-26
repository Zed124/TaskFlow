# Starts `tauri dev` with WebView2's DevTools protocol on 127.0.0.1:9333 and a window that does
# not take focus, so scripts/drive-webview.mjs can automate UI checks without touching the
# desktop. Development only; release builds never enable this.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
# Pick up tools installed since this shell started (e.g. a fresh Node install).
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
# No --remote-allow-origins: browsers (which always send an Origin) are refused, so a web page
# cannot reach this port; local tools without an Origin header (Node) can.
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9333"
$config = Join-Path $env:TEMP "taskflow-dev-inspect.json"
$window = @{ label = "main"; title = "TaskFlow"; width = 1240; height = 760; minWidth = 900; minHeight = 560;
  center = $true; theme = "Dark"; backgroundColor = "#0c0c10"; focus = $false; visible = $false }
@{ app = @{ windows = @($window) } } | ConvertTo-Json -Depth 5 | Set-Content -Path $config -Encoding ascii
npm run tauri dev -- --config $config
