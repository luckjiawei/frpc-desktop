param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^v?\d[0-9A-Za-z.+-]*$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$Version = $Version -replace '^v', ''
$releaseDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src-tauri/target/release'))
$sourceExe = Join-Path $releaseDir 'frpc-desktop.exe'
$zipPath = Join-Path $releaseDir "Frpc-Desktop_${Version}_windows_x64_portable.zip"

if (-not (Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
  throw "Windows executable not found: $sourceExe"
}

$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stagingDir | Out-Null
try {
  $portableExe = Join-Path $stagingDir 'Frpc-Desktop.exe'
  Copy-Item -LiteralPath $sourceExe -Destination $portableExe
  Compress-Archive -LiteralPath $portableExe -DestinationPath $zipPath -Force
} finally {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

if ($env:GITHUB_OUTPUT) {
  Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value "zip_path=$zipPath" -Encoding utf8
}
Write-Output $zipPath
