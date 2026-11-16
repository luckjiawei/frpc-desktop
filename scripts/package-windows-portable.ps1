param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^v?\d[0-9A-Za-z.+-]*$')]
  [string]$Version
)

$ErrorActionPreference = 'Stop'
$Version = $Version -replace '^v', ''
$releaseDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src-tauri/target/release'))
$sourceExe = Join-Path $releaseDir 'frpc-desktop.exe'
$sourceWebView2Loader = Join-Path $releaseDir 'WebView2Loader.dll'
$zipPath = Join-Path $releaseDir "Frpc-Desktop_${Version}_windows_x64_portable.zip"

if (-not (Test-Path -LiteralPath $sourceExe -PathType Leaf)) {
  throw "Windows executable not found: $sourceExe"
}

$stagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stagingDir | Out-Null
try {
  $portableExe = Join-Path $stagingDir 'Frpc-Desktop.exe'
  Copy-Item -LiteralPath $sourceExe -Destination $portableExe
  $portableFiles = @($portableExe)

  # webview2-com-sys links WebView2LoaderStatic for MSVC targets, so current
  # builds ship the loader inside the executable and emit no DLL. Keep bundling
  # it if a future build does produce one, but do not fail when it is absent.
  if (Test-Path -LiteralPath $sourceWebView2Loader -PathType Leaf) {
    $portableWebView2Loader = Join-Path $stagingDir 'WebView2Loader.dll'
    Copy-Item -LiteralPath $sourceWebView2Loader -Destination $portableWebView2Loader
    $portableFiles += $portableWebView2Loader
  } else {
    Write-Warning "WebView2Loader.dll not found next to the executable; relying on the statically linked loader."
  }

  Compress-Archive -LiteralPath $portableFiles -DestinationPath $zipPath -Force
} finally {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

if ($env:GITHUB_OUTPUT) {
  Add-Content -LiteralPath $env:GITHUB_OUTPUT -Value "zip_path=$zipPath" -Encoding utf8
}
Write-Output $zipPath
