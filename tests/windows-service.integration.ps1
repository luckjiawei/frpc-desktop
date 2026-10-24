param(
    [Parameter(Mandatory = $true)][string]$FrpDirectory,
    [Parameter(Mandatory = $true)][string]$WorkDirectory,
    [Parameter(Mandatory = $true)][string]$CallerSid
)

# Opt-in administrator test. Refuse to touch any pre-existing deployment.
$ErrorActionPreference = 'Stop'
$name = 'FrpcDesktopService'
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) $name
if ((Get-Service $name -ErrorAction SilentlyContinue) -or (Test-Path -LiteralPath $root)) {
    throw 'Integration test requires an absent service and deployment directory'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (!([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this opt-in integration test as administrator'
}
$repository = Split-Path $PSScriptRoot
$helper = Join-Path $repository 'resources\windows-service\manage-service.ps1'
$wrapper = Join-Path $repository 'resources\windows-service\WinSW.NET461.exe'
$WorkDirectory = [IO.Path]::GetFullPath($WorkDirectory)
if (Test-Path -LiteralPath $WorkDirectory) { throw 'Use a fresh test work directory' }
New-Item -ItemType Directory -Path $WorkDirectory | Out-Null
$env:TEMP = $WorkDirectory
$env:TMP = $WorkDirectory
$stage = Join-Path $WorkDirectory 'stage'
$payload = Join-Path $stage 'payload'
New-Item -ItemType Directory -Path $payload -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $FrpDirectory 'frpc.exe') -Destination $payload
Copy-Item -LiteralPath (Join-Path $repository 'resources\windows-service\LICENSE.WinSW.txt') -Destination $stage
$baseline = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'Frpc-Desktop.exe' } | Select-Object ProcessId, CreationDate)
$checks = [Collections.Generic.List[string]]::new()
$failure = $null
$server = $null
$echo = $null
$attempted = $false

function Assert-That([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}

function Get-FreePort {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $port
}

function Invoke-Management([string]$Action, [bool]$ExpectedSuccess = $true, [string]$Source = $wrapper) {
    $resultPath = Join-Path $stage 'result.json'
    if (Test-Path -LiteralPath $resultPath) { Remove-Item -LiteralPath $resultPath }
    & $helper -Action $Action -Stage $stage -Generation ([guid]::NewGuid().ToString()) `
        -CallerSid $CallerSid -GuiConfig (Join-Path $WorkDirectory 'gui.toml') -WrapperSource $Source
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    Assert-That ($result.success -eq $ExpectedSuccess) "$Action returned unexpected result: $($result | ConvertTo-Json -Compress)"
    return $result
}

function Test-Tunnel {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        if (!$client.ConnectAsync('127.0.0.1', $remotePort).Wait(500)) { return $false }
        $stream = $client.GetStream()
        $stream.ReadTimeout = 1000
        $buffer = New-Object byte[] 64
        $count = $stream.Read($buffer, 0, $buffer.Length)
        return [Text.Encoding]::ASCII.GetString($buffer, 0, $count) -eq 'service-test-ok'
    } catch { return $false } finally { $client.Dispose() }
}

function Wait-Tunnel {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    while (!(Test-Tunnel)) {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Loopback tunnel did not recover within 45 seconds' }
        Start-Sleep -Milliseconds 250
    }
}

function Get-ServiceChild {
    $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
    return Get-CimInstance Win32_Process -Filter "ParentProcessId=$($service.ProcessId) AND Name='frpc.exe'" | Select-Object -First 1
}

try {
    $bindPort = Get-FreePort
    $localPort = Get-FreePort
    $remotePort = Get-FreePort
    Assert-That (@($bindPort, $localPort, $remotePort | Select-Object -Unique).Count -eq 3) 'Ports must be distinct'
    $frpsConfig = Join-Path $WorkDirectory 'frps.toml'
    [IO.File]::WriteAllText($frpsConfig, @"
bindAddr = "127.0.0.1"
proxyBindAddr = "127.0.0.1"
bindPort = $bindPort
"@)
    $server = Start-Process -FilePath (Join-Path $FrpDirectory 'frps.exe') `
        -ArgumentList @('-c', "`"$frpsConfig`"") -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $WorkDirectory 'frps.stdout.log') `
        -RedirectStandardError (Join-Path $WorkDirectory 'frps.stderr.log')
    $echo = Start-Job -ArgumentList $localPort -ScriptBlock {
        param($Port)
        $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        try {
            while ($true) {
                if (!$listener.Pending()) {
                    Start-Sleep -Milliseconds 100
                    continue
                }
                $client = $listener.AcceptTcpClient()
                try {
                    $bytes = [Text.Encoding]::ASCII.GetBytes('service-test-ok')
                    $client.GetStream().Write($bytes, 0, $bytes.Length)
                } finally { $client.Dispose() }
            }
        } finally { $listener.Stop() }
    }
    $config = @"
serverAddr = "127.0.0.1"
serverPort = $bindPort
loginFailExit = false
log.to = "$($root.Replace('\', '/'))/logs/frpc.log"
[[proxies]]
name = "isolated-service-test"
type = "tcp"
localIP = "127.0.0.1"
localPort = $localPort
remotePort = $remotePort
"@
    [IO.File]::WriteAllText((Join-Path $payload 'frpc.toml'), $config)
    $attempted = $true
    Invoke-Management 'install' | Out-Null
    Wait-Tunnel
    $checks.Add('install and loopback tunnel')
    $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
    $account = [Security.Principal.NTAccount]::new($service.StartName)
    Assert-That ($account.Translate([Security.Principal.SecurityIdentifier]).Value -eq 'S-1-5-19') 'Service must use LocalService'
    Assert-That ($service.StartMode -eq 'Auto') 'Service must auto-start'
    Assert-That ((Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\$name").DelayedAutoStart -eq 1) 'Delayed auto-start must be configured'
    $child = Get-ServiceChild
    Assert-That ($null -ne $child -and $child.SessionId -eq 0) 'frpc must run in session 0'
    $owner = Invoke-CimMethod -InputObject $child -MethodName GetOwnerSid
    Assert-That ($owner.Sid -eq 'S-1-5-19') 'frpc must run as LocalService'
    $checks.Add('LocalService identity, session 0 and delayed auto-start')
    $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete
    foreach ($target in @($root, (Join-Path $root 'service.exe'), $child.ExecutablePath)) {
        $rules = (Get-Acl -LiteralPath $target).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
        Assert-That (!($rules | Where-Object { $_.IdentityReference.Value -eq 'S-1-5-19' -and ($_.FileSystemRights -band $writeRights) })) 'LocalService must not write binaries or deployment root'
    }
    $logRules = (Get-Acl -LiteralPath (Join-Path $root 'logs')).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    Assert-That ([bool]($logRules | Where-Object { $_.IdentityReference.Value -eq 'S-1-5-19' -and ($_.FileSystemRights -band $writeRights) })) 'LocalService must write logs'
    $checks.Add('binary/config ACLs and writable log directory')

    # Kill only the child belonging to this freshly created test deployment.
    Assert-That ($child.ExecutablePath.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) 'Unexpected child executable'
    Stop-Process -Id $child.ProcessId -Force
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        Start-Sleep -Milliseconds 500
        $replacement = Get-ServiceChild
        if ([DateTime]::UtcNow -gt $deadline) { throw 'Service child was not restarted' }
    } while (!$replacement -or $replacement.ProcessId -eq $child.ProcessId)
    Wait-Tunnel
    $checks.Add('child crash recovery and restored tunnel')

    $oldXml = [IO.File]::ReadAllText((Join-Path $root 'service.xml'))
    [IO.File]::WriteAllText((Join-Path $payload 'frpc.toml'), 'invalid = [')
    $rollback = Invoke-Management 'sync' $false
    Assert-That ($rollback.code -ne 'SERVICE_ROLLBACK_FAILED') 'Rollback must succeed'
    Assert-That ([IO.File]::ReadAllText((Join-Path $root 'service.xml')) -eq $oldXml) 'Failed update must preserve previous snapshot'
    Wait-Tunnel
    $checks.Add('invalid update rollback and restored tunnel')
    [IO.File]::WriteAllText((Join-Path $payload 'frpc.toml'), $config)
    Invoke-Management 'sync' | Out-Null
    Wait-Tunnel
    Assert-That (@(Get-ChildItem -LiteralPath (Join-Path $root 'generations') -Directory).Count -eq 1) 'Old generations must be cleaned'
    $checks.Add('running snapshot update and generation cleanup')

    Invoke-Management 'stop' | Out-Null
    Assert-That ((Get-Service $name).Status -eq 'Stopped') 'Service must stop'
    Assert-That (!(Test-Tunnel)) 'Stopped tunnel must not accept traffic'
    Invoke-Management 'sync' | Out-Null
    Assert-That ((Get-Service $name).Status -eq 'Stopped') 'Updating a stopped service must keep it stopped'
    Invoke-Management 'start' | Out-Null
    Wait-Tunnel
    $checks.Add('stop, update while stopped, start')
    Invoke-Management 'uninstall' | Out-Null
    Assert-That (!(Get-Service $name -ErrorAction SilentlyContinue)) 'Service must be deleted'
    Assert-That (!(Test-Path -LiteralPath $root)) 'Deployment directory must be removed'
    $checks.Add('uninstall removes service, snapshots and logs')
    $corrupt = Join-Path $WorkDirectory 'corrupt.exe'
    [IO.File]::WriteAllText($corrupt, 'invalid-wrapper')
    $rejected = Invoke-Management 'install' $false $corrupt
    Assert-That ($rejected.code -eq 'SERVICE_HOST_INTEGRITY_FAILED') 'Corrupt wrapper must be rejected'
    Assert-That (!(Test-Path -LiteralPath $root)) 'Failed installation must roll back deployment'
    $checks.Add('host integrity failure and installation rollback')
} catch {
    $failure = $_.ToString()
} finally {
    if ($attempted -and ((Get-Service $name -ErrorAction SilentlyContinue) -or (Test-Path -LiteralPath $root))) {
        try { Invoke-Management 'uninstall' | Out-Null } catch { $failure = "$failure; cleanup failed: $_" }
    }
    if ($server -and !$server.HasExited) { $server.Kill(); $server.WaitForExit() }
    if ($echo) { Stop-Job $echo; Remove-Job $echo -Force }
    foreach ($original in $baseline) {
        $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($original.ProcessId)"
        if (!$current -or $current.CreationDate -ne $original.CreationDate) { $failure = "$failure; existing GUI process changed" }
    }
    @{
        success = !$failure
        checks = @($checks.ToArray())
        failure = $failure
        serviceRemaining = [bool](Get-Service $name -ErrorAction SilentlyContinue)
        deploymentRemaining = Test-Path -LiteralPath $root
        existingGuiProcesses = @($baseline.ProcessId)
    } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $WorkDirectory 'integration-result.json') -Encoding UTF8
}
if ($failure) { throw $failure }
