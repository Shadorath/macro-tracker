# Publishes the app in one go:
#   1. builds it (stops if the build fails)
#   2. checks that no secret is about to be committed
#   3. commits everything with your message and pushes to GitHub
#   4. waits until GitHub Pages has deployed it
#
# Use:  npm run ship -- -Message "What changed"
#  or:  npm run ship -- -MessageFile path\to\message.txt   (for longer messages)

param(
  [string]$Message,
  [string]$MessageFile
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { $env:Path = "C:\Program Files\nodejs;$env:Path" }
function Fail($text) { Write-Host "STOPPED: $text" -ForegroundColor Red; exit 1 }

if (-not $Message -and -not $MessageFile) { Fail 'Give a commit message: -Message "..." or -MessageFile file.txt' }

# 1. Build
npm run build | Select-Object -Last 1
if ($LASTEXITCODE -ne 0) { Fail 'The build failed. Nothing was committed.' }

# 2. Secret check on everything that would be committed
git add -A 2>$null   # (hides git's harmless line-ending warnings)
$staged = (git diff --cached) -join "`n"
if (-not $staged) { Write-Host 'Nothing to publish: no changes.'; exit 0 }

# a) things that look like a Gemini key, a deployed Apps Script URL or a token value
if ($staged -match 'AIza[0-9A-Za-z_\-]{20,}|script\.google\.com/macros/s/[A-Za-z0-9_\-]{20,}|TOKEN=[A-Za-z0-9_\-]{16,}') {
  git reset -q
  Fail 'Something that looks like a secret is in the changes. Nothing was committed.'
}
# b) the real values from the secrets file outside the repo (never printed)
$secretsFile = Join-Path $env:USERPROFILE 'macro-tracker-secrets.txt'
if (Test-Path $secretsFile) {
  foreach ($line in Get-Content $secretsFile) {
    $value = ($line -split '=', 2)[1]
    if ($value -and $value.Length -ge 8 -and $staged.Contains($value)) {
      git reset -q
      Fail 'A value from macro-tracker-secrets.txt is in the changes. Nothing was committed.'
    }
  }
}
Write-Host 'No secrets found.'

# 3. Commit and push
if ($MessageFile) { git commit -q -F $MessageFile } else { git commit -q -m $Message }
if ($LASTEXITCODE -ne 0) { Fail 'The commit failed.' }
git push -q 2>$null
if ($LASTEXITCODE -ne 0) { Fail 'The push failed. The commit is saved on this computer only.' }
Write-Host ('Pushed: ' + (git log --oneline -1))

# 4. Wait for GitHub Pages (checks every 10 s, for up to 5 minutes)
$head = git rev-parse HEAD
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 10
  try {
    $run = (Invoke-RestMethod 'https://api.github.com/repos/Shadorath/macro-tracker/actions/runs?per_page=1').workflow_runs[0]
  } catch { continue }
  if ($run.head_sha -eq $head -and $run.status -eq 'completed') {
    if ($run.conclusion -eq 'success') { Write-Host 'Deploy: success. Live at https://shadorath.github.io/macro-tracker/'; exit 0 }
    Fail "Deploy finished with: $($run.conclusion). See the Actions tab on GitHub."
  }
}
Fail 'The deploy did not finish within 5 minutes. See the Actions tab on GitHub.'
