# Makes the app icon PNGs (192 and 512 px) from public/icons/icon.svg.
# Uses Microsoft Edge (built into Windows) in the background to draw the SVG,
# so no extra tools are needed. Run with:  npm run icons

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $root 'public\icons'
$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge not found.' }

# A tiny page that shows the SVG filling the whole window.
$page = Join-Path $env:TEMP 'macro-tracker-icon.html'
$svgUrl = 'file:///' + ((Join-Path $icons 'icon.svg') -replace '\\', '/')
"<html><body style='margin:0'><img src='$svgUrl' style='display:block;width:100vw;height:100vh'></body></html>" |
  Set-Content -Encoding utf8 $page

# Edge prints "bytes written" on its error output; that's not a failure.
$ErrorActionPreference = 'Continue'
# Edge can't make very small windows, so it always draws at 512 x 512 and
# scales the picture down (scale factor 0.375 gives 192 px).
foreach ($size in 192, 512) {
  $out = Join-Path $icons "icon-$size.png"
  $scale = $size / 512
  & $edge --headless=new --disable-gpu --hide-scrollbars "--force-device-scale-factor=$scale" `
    '--window-size=512,512' "--screenshot=$out" "file:///$($page -replace '\\', '/')" 2>$null | Out-Null
  Start-Sleep -Seconds 2
  Write-Host "Made $out"
}
