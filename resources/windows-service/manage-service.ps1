param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'start', 'stop', 'sync', 'uninstall')][string]$Action,
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f-]{36}$')][string]$Generation,
    [Parameter(Mandatory = $true)][ValidatePattern('^S-1-\d+(-\d+)+$')][string]$CallerSid
)

$ErrorActionPreference = 'Stop'
$name = 'FrpcDesktopService'
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) $name
$wrapper = Join-Path $root 'service.exe'
$xmlPath = Join-Path $root 'service.xml'
$markerPath = Join-Path $root 'installation.json'
$mutex = New-Object Threading.Mutex($false, 'Global\FrpcDesktopServiceManagement')
$locked = $false
$created = $false
$newDirectory = $null
$oldXml = $null
$wasRunning = $false

function Assert-NoReparse([string]$Target) {
    $item = Get-Item -LiteralPath $Target -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'SERVICE_UNSAFE_PATH' }
}

function Assert-Tree([string]$Target) {
    Assert-NoReparse $Target
    # Inspect each level before descending; do not follow a junction during enumeration.
    foreach ($item in Get-ChildItem -LiteralPath $Target -Force) {
        Assert-NoReparse $item.FullName
        if ($item.PSIsContainer) { Assert-Tree $item.FullName }
    }
}

function Set-DirectoryAcl([string]$Target, [bool]$WritableLogs = $false) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule(
            (New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    $rights = if ($WritableLogs) { 'Modify' } else { 'ReadAndExecute' }
    $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
        (New-Object Security.Principal.SecurityIdentifier('S-1-5-19')), $rights, 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    if ($CallerSid -notin @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-19')) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
            (New-Object Security.Principal.SecurityIdentifier($CallerSid)), 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl -LiteralPath $Target -AclObject $acl
}

function Invoke-Wrapper([string]$Command) {
    & $wrapper $Command 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'SERVICE_OPERATION_FAILED' }
}

function Wait-State([string]$Expected) {
    $controller = Get-Service -Name $name
    $controller.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::$Expected, [TimeSpan]::FromSeconds(30))
    $controller.Dispose()
}

function Stop-OwnedService {
    $service = Get-Service -Name $name
    if ($service.Status -ne 'Stopped') {
        Stop-Service -Name $name
        Wait-State 'Stopped'
    }
}

function Wait-Deleted {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (Get-CimInstance Win32_Service -Filter "Name='$name'") {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'SERVICE_DELETE_PENDING' }
        Start-Sleep -Milliseconds 250
    }
}

function Get-ServiceExecutablePath([string]$PathName) {
    if ($PathName -match '^\s*"([^"]+)"') { return $Matches[1] }
    return ($PathName -split '\s+', 2)[0]
}

function Write-ServiceXml([string]$Directory) {
    $escaped = [Security.SecurityElement]::Escape($Directory)
    $logPath = [Security.SecurityElement]::Escape((Join-Path $root 'logs'))
    $xml = @"
<service>
  <id>FrpcDesktopService</id>
  <name>Frpc Desktop Service</name>
  <description>Frpc Desktop unattended tunnels / Windows service</description>
  <executable>$escaped\frpc.exe</executable>
  <arguments>-c &quot;$escaped\frpc.toml&quot;</arguments>
  <workingdirectory>$escaped</workingdirectory>
  <startmode>Automatic</startmode>
  <delayedAutoStart/>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="15 sec"/>
  <onfailure action="restart" delay="60 sec"/>
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>15 sec</stoptimeout>
  <logpath>$logPath</logpath>
  <log mode="roll"/>
</service>
"@
    [IO.File]::WriteAllText($xmlPath, $xml, (New-Object Text.UTF8Encoding($false)))
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'SERVICE_ADMIN_REQUIRED' }
    $locked = $mutex.WaitOne(0)
    if (!$locked) { throw 'SERVICE_BUSY' }
    $Stage = [IO.Path]::GetFullPath($Stage)
    Assert-Tree $Stage
    Assert-NoReparse ([Environment]::GetFolderPath('CommonApplicationData'))
    $existing = Get-CimInstance Win32_Service -Filter "Name='$name'"
    if ($existing -and [IO.Path]::GetFullPath((Get-ServiceExecutablePath $existing.PathName)) -ne [IO.Path]::GetFullPath($wrapper)) { throw 'SERVICE_CONFLICT' }
    if ($Action -eq 'install') {
        if ($existing -or (Test-Path -LiteralPath $root)) { throw 'SERVICE_CONFLICT' }
        New-Item -ItemType Directory -Path $root | Out-Null
        $created = $true
        Set-DirectoryAcl $root
        @{ format = 1; owner = $CallerSid } | ConvertTo-Json -Compress | Set-Content -LiteralPath $markerPath -Encoding UTF8
        Copy-Item -LiteralPath (Join-Path $Stage 'service.exe') -Destination $wrapper
        Copy-Item -LiteralPath (Join-Path $Stage 'LICENSE.WinSW.txt') -Destination $root
        New-Item -ItemType Directory -Path (Join-Path $root 'logs') | Out-Null
        Set-DirectoryAcl (Join-Path $root 'logs') $true
        New-Item -ItemType Directory -Path (Join-Path $root 'generations') | Out-Null
    } else {
        if (!$existing) { throw 'SERVICE_NOT_INSTALLED' }
        Assert-Tree $root
        $owner = (Get-Acl -LiteralPath $root).GetOwner([Security.Principal.SecurityIdentifier]).Value
        if ($owner -notin @('S-1-5-18', 'S-1-5-32-544')) { throw 'SERVICE_UNSAFE_PATH' }
        $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
        if ($marker.format -ne 1) { throw 'SERVICE_CONFLICT' }
        if ($marker.owner -ne $CallerSid -and $Action -eq 'sync') { throw 'SERVICE_OWNER_MISMATCH' }
    }
    switch ($Action) {
        'start' {
            Start-Service -Name $name
            Wait-State 'Running'
        }
        'stop' { Stop-OwnedService }
        'uninstall' {
            Stop-OwnedService
            Invoke-Wrapper 'uninstall'
            Wait-Deleted
            # Only this fixed, owned, reparse-free deployment directory is removed.
            Assert-Tree $root
            Remove-Item -LiteralPath $root -Recurse -Force
        }
        { $_ -in @('install', 'sync') } {
            $newDirectory = Join-Path (Join-Path $root 'generations') $Generation
            if (Test-Path -LiteralPath $newDirectory) { throw 'SERVICE_CONFLICT' }
            New-Item -ItemType Directory -Path $newDirectory | Out-Null
            $payload = Join-Path $Stage 'payload'
            Assert-Tree $payload
            foreach ($required in @('frpc.exe', 'frpc.toml')) {
                if (!(Test-Path -LiteralPath (Join-Path $payload $required) -PathType Leaf)) { throw 'SERVICE_PAYLOAD_MISSING' }
            }
            Get-ChildItem -LiteralPath $payload -Force | Copy-Item -Destination $newDirectory -Recurse
            if ($Action -eq 'sync') {
                $oldXml = [IO.File]::ReadAllText($xmlPath)
                $wasRunning = (Get-Service -Name $name).Status -eq 'Running'
                Stop-OwnedService
            }
            Write-ServiceXml $newDirectory
            if ($Action -eq 'install') { Invoke-Wrapper 'install' }
            if ($Action -eq 'install' -or $wasRunning) {
                Start-Service -Name $name
                Wait-State 'Running'
                Start-Sleep -Seconds 2
                if ((Get-Service -Name $name).Status -ne 'Running') { throw 'SERVICE_START_FAILED' }
            }
            # Successful activation retains only the current snapshot. Source
            # versions, database and certificates in userData are never removed.
            foreach ($previous in Get-ChildItem -LiteralPath (Join-Path $root 'generations') -Directory) {
                if ($previous.FullName -ne $newDirectory) {
                    Assert-Tree $previous.FullName
                    Remove-Item -LiteralPath $previous.FullName -Recurse -Force
                }
            }
        }
    }
    $result = @{ success = $true }
} catch {
    $code = [string]$_.Exception.Message
    if ($code -notmatch '^SERVICE_[A-Z_]+$') { $code = 'SERVICE_OPERATION_FAILED' }
    try {
        if ($created) {
            if (Get-CimInstance Win32_Service -Filter "Name='$name'") {
                Stop-OwnedService
                Invoke-Wrapper 'uninstall'
                Wait-Deleted
            }
            Assert-Tree $root
            Remove-Item -LiteralPath $root -Recurse -Force
        } elseif ($oldXml) {
            Stop-OwnedService
            [IO.File]::WriteAllText($xmlPath, $oldXml, (New-Object Text.UTF8Encoding($false)))
            if ($wasRunning) { Start-Service -Name $name; Wait-State 'Running' }
            if ($newDirectory -and (Test-Path -LiteralPath $newDirectory)) {
                Assert-Tree $newDirectory
                Remove-Item -LiteralPath $newDirectory -Recurse -Force
            }
        }
    } catch { $code = 'SERVICE_ROLLBACK_FAILED' }
    $result = @{ success = $false; code = $code }
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
[IO.File]::WriteAllText((Join-Path $Stage 'result.json'), ($result | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
