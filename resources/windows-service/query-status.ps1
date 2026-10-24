$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'FrpcDesktopService'
$service = Get-CimInstance Win32_Service -Filter "Name='FrpcDesktopService'"
if ($service) {
    $servicePath = if ($service.PathName -match '^\s*"([^"]+)"') { $Matches[1] } else { ($service.PathName -split '\s+', 2)[0] }
    if ([IO.Path]::GetFullPath($servicePath) -ne [IO.Path]::GetFullPath((Join-Path $root 'service.exe'))) { throw 'SERVICE_CONFLICT' }
    $account = New-Object Security.Principal.NTAccount($service.StartName)
    if ($account.Translate([Security.Principal.SecurityIdentifier]).Value -ne 'S-1-5-19') { throw 'SERVICE_ACCOUNT_MISMATCH' }
}
$deploymentExists = Test-Path -LiteralPath $root
$startTime = -1
if ($service -and $service.State -eq 'Running' -and $service.ProcessId) {
    $process = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($service.ProcessId) AND Name='frpc.exe'" | Select-Object -First 1
    if (!$process) { $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($service.ProcessId)" }
    if ($process.CreationDate) { $startTime = ([DateTimeOffset]$process.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds() }
}
@{
    supported = $true
    installed = [bool]$service
    running = [bool]($service -and $service.State -eq 'Running')
    deploymentExists = [bool]$deploymentExists
    lastStartTime = $startTime
    state = $(if (!$service) { if ($deploymentExists) { 'cleanupRequired' } else { 'notInstalled' } } elseif ($service.State -eq 'Running') { 'running' } elseif ($service.State -eq 'Stopped') { 'stopped' } else { 'pending' })
    directory = $root
} | ConvertTo-Json -Compress
