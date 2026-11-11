# 通过 GitHub Git Data API 推送当前提交（当时 github.com:443 不通，api.github.com 正常）
# 用法: powershell -File tools\push-via-api.ps1 -Message "提交说明"
param(
  [string]$Message = "update"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$token = (gh auth token).Trim()
if (-not $token) { throw "gh 未登录，取不到 token" }

$headers = @{
  Authorization = "Bearer $token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}
$api = "https://api.github.com/repos/GzxingR/modao-open"

# 1) 本地要提交的改动
git add -A
$pending = git status --porcelain
if ($pending) {
  $tmp = Join-Path $env:TEMP "push-msg.txt"
  [System.IO.File]::WriteAllText($tmp, $Message, [System.Text.UTF8Encoding]::new($false))
  git commit -q -F $tmp
  "committed: " + (git log --oneline -1)
} else {
  "no local changes (使用最近一次提交)"
}

# 2) 本次提交改了哪些文件
$files = @(git diff --name-only HEAD~1 HEAD)
if ($files.Count -eq 0) { throw "没有可推送的差异（HEAD~1 不存在？）" }
"files: $($files.Count)"

# 3) 远端当前位置
$ref = Invoke-RestMethod "$api/git/ref/heads/main" -Headers $headers
$baseCommit = $ref.object.sha
$baseTree = (Invoke-RestMethod "$api/git/commits/$baseCommit" -Headers $headers).tree.sha
"remote base: $($baseCommit.Substring(0,7))"

# 4) 上传 blob 并组 tree
$treeItems = @()
foreach ($f in $files) {
  $p = Join-Path $repoRoot $f
  if (-not (Test-Path $p)) { "  skip (deleted): $f"; continue }
  $bytes = [System.IO.File]::ReadAllBytes($p)
  $body = @{ content = [Convert]::ToBase64String($bytes); encoding = "base64" } | ConvertTo-Json -Compress
  $blob = Invoke-RestMethod "$api/git/blobs" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json"
  $treeItems += @{ path = ($f -replace '\\', '/'); mode = "100644"; type = "blob"; sha = $blob.sha }
  "  blob $f ($([Math]::Round($bytes.Length / 1KB, 1)) KB)"
}

$treeBody = @{ base_tree = $baseTree; tree = $treeItems } | ConvertTo-Json -Depth 6 -Compress
$newTree = Invoke-RestMethod "$api/git/trees" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($treeBody)) -ContentType "application/json"
"new tree: $($newTree.sha.Substring(0,7))"

# 5) 建 commit 并移动分支
$commitBody = @{ message = $Message; tree = $newTree.sha; parents = @($baseCommit) } | ConvertTo-Json -Compress
$newCommit = Invoke-RestMethod "$api/git/commits" -Method Post -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($commitBody)) -ContentType "application/json"
"new commit: $($newCommit.sha.Substring(0,7))"

$refBody = @{ sha = $newCommit.sha; force = $false } | ConvertTo-Json -Compress
Invoke-RestMethod "$api/git/refs/heads/main" -Method Patch -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($refBody)) -ContentType "application/json" | Out-Null
"main updated -> $($newCommit.sha.Substring(0,7))"
