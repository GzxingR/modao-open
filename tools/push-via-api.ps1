# Push current commit via GitHub Git Data API (use when github.com:443 is blocked but api.github.com works).
# Usage: powershell -ExecutionPolicy Bypass -File tools\push-via-api.ps1 -Message "commit message"
param(
  [string]$Message = "update"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$token = (gh auth token).Trim()
if (-not $token) { throw "gh not logged in" }

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
$api = "https://api.github.com/repos/GzxingR/modao-open"

# 1) commit local changes if any
git add -A
$pending = git status --porcelain
if ($pending) {
  $tmp = Join-Path $env:TEMP "push-msg.txt"
  [System.IO.File]::WriteAllText($tmp, $Message, [System.Text.UTF8Encoding]::new($false))
  git commit -q -F $tmp
  "committed: " + (git log --oneline -1)
} else {
  "no local changes, pushing last commit"
}

# 2) files changed in the last commit
$files = @(git diff --name-only HEAD~1 HEAD)
if ($files.Count -eq 0) { throw "no diff against HEAD~1" }
"files: $($files.Count)"

# 3) remote position
$refUrl = $api + "/git/ref/heads/main"
$ref = Invoke-RestMethod $refUrl -Headers $headers
$baseCommit = $ref.object.sha
$commitUrl = $api + "/git/commits/" + $baseCommit
$baseTree = (Invoke-RestMethod $commitUrl -Headers $headers).tree.sha
"remote base: " + $baseCommit.Substring(0,7)

# 4) blobs + tree
$treeItems = @()
foreach ($f in $files) {
  $p = Join-Path $repoRoot $f
  if (-not (Test-Path $p)) { "  skip deleted: $f"; continue }
  $bytes = [System.IO.File]::ReadAllBytes($p)
  $body = @{ content = [Convert]::ToBase64String($bytes); encoding = "base64" } | ConvertTo-Json -Compress
  $blobUrl = $api + "/git/blobs"
  $blob = Invoke-RestMethod $blobUrl -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json"
  $treeItems += @{ path = ($f -replace '\\', '/'); mode = "100644"; type = "blob"; sha = $blob.sha }
  "  blob $f ($([Math]::Round($bytes.Length / 1KB, 1)) KB)"
}

$treeBody = @{ base_tree = $baseTree; tree = $treeItems } | ConvertTo-Json -Depth 6 -Compress
$treeUrl = $api + "/git/trees"
$newTree = Invoke-RestMethod $treeUrl -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($treeBody)) -ContentType "application/json"
"new tree: " + $newTree.sha.Substring(0,7)

# 5) commit + move branch
$commitBody = @{ message = $Message; tree = $newTree.sha; parents = @($baseCommit) } | ConvertTo-Json -Compress
$newCommitUrl = $api + "/git/commits"
$newCommit = Invoke-RestMethod $newCommitUrl -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($commitBody)) -ContentType "application/json"
"new commit: " + $newCommit.sha.Substring(0,7)

$refBody = @{ sha = $newCommit.sha; force = $false } | ConvertTo-Json -Compress
$patchUrl = $api + "/git/refs/heads/main"
Invoke-RestMethod $patchUrl -Method Patch -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($refBody)) -ContentType "application/json" | Out-Null
"main updated -> " + $newCommit.sha.Substring(0,7)
