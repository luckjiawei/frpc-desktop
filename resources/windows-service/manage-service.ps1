param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'start', 'stop', 'sync', 'uninstall')][string]$Action,
    [Parameter(Mandatory = $true)][string]$Stage,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-f-]{36}$')][string]$Generation,
    [Parameter(Mandatory = $true)][ValidatePattern('^S-1-\d+(-\d+)+$')][string]$CallerSid,
    [Parameter(Mandatory = $true)][string]$GuiConfig,
    [Parameter(Mandatory = $true)][string]$WrapperSource
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
$committed = $false
$cleanupPending = $false
$wrapperHash = 'b5066b7bbdfba1293e5d15cda3caaea88fbeab35bd5b38c41c913d492aadfc4f'

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

function Assert-ProtectedAcl([string]$Target, [bool]$WritableLogs = $false) {
    $acl = Get-Acl -LiteralPath $Target
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin @('S-1-5-18', 'S-1-5-32-544')) {
        throw 'SERVICE_UNSAFE_PATH'
    }
    $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        $trusted = @('S-1-5-18', 'S-1-5-32-544')
        if ($WritableLogs) { $trusted += 'S-1-5-19' }
        if ($rule.AccessControlType -eq 'Allow' -and ($rule.FileSystemRights -band $writeRights) -and $rule.IdentityReference.Value -notin $trusted) {
            throw 'SERVICE_UNSAFE_PATH'
        }
    }
}

function Assert-Deployment {
    Assert-Tree $root
    Assert-ProtectedAcl $root
    foreach ($item in Get-ChildItem -LiteralPath $root -Recurse -Force) {
        $logs = Join-Path $root 'logs'
        $isLog = $item.FullName -eq $logs -or $item.FullName.StartsWith($logs + '\', [StringComparison]::OrdinalIgnoreCase)
        # Log files created by LocalService may be owned by that account.
        if (!$isLog) { Assert-ProtectedAcl $item.FullName }
    }
}

function Reset-PayloadAcl([string]$Target) {
    $targets = @(Get-Item -LiteralPath $Target -Force) + @(Get-ChildItem -LiteralPath $Target -Recurse -Force)
    foreach ($item in $targets) {
        if ($item.PSIsContainer) {
            $acl = New-Object Security.AccessControl.DirectorySecurity
            $acl.SetAccessRuleProtection($true, $false)
            $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
            $inherit = 'ContainerInherit,ObjectInherit'
        } else {
            $acl = New-Object Security.AccessControl.FileSecurity
            $acl.SetAccessRuleProtection($true, $false)
            $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
            $inherit = 'None'
        }
        foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', $inherit, 'None', 'Allow')))
        }
        foreach ($sid in @('S-1-5-19', $CallerSid)) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'ReadAndExecute', $inherit, 'None', 'Allow')))
        }
        Set-Acl -LiteralPath $item.FullName -AclObject $acl
    }
}

function Invoke-Wrapper([string]$Command) {
    Assert-NoReparse $wrapper
    Assert-ProtectedAcl $wrapper
    # The protected destination, never the mutable stage, is executed. Keep
    # this handle open to deny writes/deletion between verification and exec.
    $stream = [IO.File]::Open($wrapper, 'Open', 'Read', 'Read')
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $actual = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        if ($actual -ne $wrapperHash) { throw 'SERVICE_HOST_INTEGRITY_FAILED' }
        & $wrapper $Command 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'SERVICE_OPERATION_FAILED' }
    } finally { $sha.Dispose(); $stream.Dispose() }
}

function Assert-OwnedService {
    $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
    if (!$service) { throw 'SERVICE_NOT_INSTALLED' }
    $account = New-Object Security.Principal.NTAccount($service.StartName)
    if ($account.Translate([Security.Principal.SecurityIdentifier]).Value -ne 'S-1-5-19') {
        throw 'SERVICE_ACCOUNT_MISMATCH'
    }
    return $service
}

function Start-OwnedService {
    $service = Assert-OwnedService
    Start-Service -Name $name
    Wait-State 'Running'
}

function Remove-Deployment {
    Assert-Deployment
    # Keep the marker until all other contents have been removed so cleanup
    # can be retried after interruption. An empty protected root is recoverable.
    foreach ($item in Get-ChildItem -LiteralPath $root -Force) {
        if ($item.FullName -ne $markerPath) { Remove-Item -LiteralPath $item.FullName -Recurse -Force }
    }
    if (Test-Path -LiteralPath $markerPath) { Remove-Item -LiteralPath $markerPath -Force }
    Remove-Item -LiteralPath $root -Force
}

function Remove-PreviousGenerations {
    foreach ($previous in Get-ChildItem -LiteralPath (Join-Path $root 'generations') -Directory) {
        if ($previous.FullName -ne $newDirectory) {
            try {
                Assert-Tree $previous.FullName
                Remove-Item -LiteralPath $previous.FullName -Recurse -Force
            } catch { $script:cleanupPending = $true }
        }
    }
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
  <!-- WinSW 2.x uses domain/user for the built-in LocalService account. -->
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
        if ($existing) { throw 'SERVICE_CONFLICT' }
        if (Test-Path -LiteralPath $root) {
            Assert-Deployment
            if (!(Test-Path -LiteralPath $markerPath)) { throw 'SERVICE_CONFLICT' }
            Remove-Deployment
        }
        New-Item -ItemType Directory -Path $root | Out-Null
        $created = $true
        Set-DirectoryAcl $root
        @{ format = 1; owner = $CallerSid } | ConvertTo-Json -Compress | Set-Content -LiteralPath $markerPath -Encoding UTF8
        Assert-NoReparse $WrapperSource
        $sourceHash = (Get-FileHash -LiteralPath $WrapperSource -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($sourceHash -ne $wrapperHash) { throw 'SERVICE_HOST_INTEGRITY_FAILED' }
        Copy-Item -LiteralPath $WrapperSource -Destination $wrapper
        Copy-Item -LiteralPath (Join-Path $Stage 'LICENSE.WinSW.txt') -Destination $root
        New-Item -ItemType Directory -Path (Join-Path $root 'logs') | Out-Null
        Set-DirectoryAcl (Join-Path $root 'logs') $true
        New-Item -ItemType Directory -Path (Join-Path $root 'generations') | Out-Null
    } else {
        if (!$existing -and $Action -ne 'uninstall') { throw 'SERVICE_NOT_INSTALLED' }
        Assert-Deployment
        if (Test-Path -LiteralPath $markerPath) {
            $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
            if ($marker.format -ne 1) { throw 'SERVICE_CONFLICT' }
            if ($marker.owner -ne $CallerSid -and $Action -eq 'sync') { throw 'SERVICE_OWNER_MISMATCH' }
        } elseif ($existing -or @(Get-ChildItem -LiteralPath $root -Force).Count -ne 0) {
            throw 'SERVICE_CONFLICT'
        }
    }
    switch ($Action) {
        'start' {
            Start-OwnedService
        }
        'stop' {
            Assert-OwnedService | Out-Null
            Stop-OwnedService
        }
        'uninstall' {
            if ($existing) {
                Assert-OwnedService | Out-Null
                Stop-OwnedService
                Invoke-Wrapper 'uninstall'
                Wait-Deleted
            }
            # Only this fixed, owned, reparse-free deployment directory is removed.
            Remove-Deployment
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
            Reset-PayloadAcl $newDirectory
            if ($Action -eq 'sync') {
                Assert-OwnedService | Out-Null
                $oldXml = [IO.File]::ReadAllText($xmlPath)
                $wasRunning = (Get-Service -Name $name).Status -eq 'Running'
                Stop-OwnedService
            }
            Write-ServiceXml $newDirectory
            if ($Action -eq 'install') {
                $gui = Get-CimInstance Win32_Process -Filter "Name='frpc.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($GuiConfig) }
                if ($gui) { throw 'SERVICE_STOP_GUI_FIRST' }
            }
            if ($Action -eq 'install') { Invoke-Wrapper 'install' }
            if ($Action -eq 'install' -or $wasRunning) {
                Start-OwnedService
                Start-Sleep -Seconds 2
                if ((Get-Service -Name $name).Status -ne 'Running') { throw 'SERVICE_START_FAILED' }
            }
            $committed = $true
            # Cleanup is best-effort after commit; never roll back to a snapshot
            # which cleanup may already have partially removed.
            try { Remove-PreviousGenerations } catch { $cleanupPending = $true }
        }
    }
    $result = @{ success = $true; cleanupPending = $cleanupPending }
} catch {
    $code = [string]$_.Exception.Message
    if ($code -notmatch '^SERVICE_[A-Z_]+$') { $code = 'SERVICE_OPERATION_FAILED' }
    try {
        if ($created -and !$committed) {
            if (Get-CimInstance Win32_Service -Filter "Name='$name'") {
                Stop-OwnedService
                Invoke-Wrapper 'uninstall'
                Wait-Deleted
            }
            Remove-Deployment
        } elseif ($oldXml -and !$committed) {
            Stop-OwnedService
            [IO.File]::WriteAllText($xmlPath, $oldXml, (New-Object Text.UTF8Encoding($false)))
            if ($wasRunning) { Start-OwnedService }
        }
        if (!$created -and !$committed -and $newDirectory -and (Test-Path -LiteralPath $newDirectory)) {
            Assert-Tree $newDirectory
            Remove-Item -LiteralPath $newDirectory -Recurse -Force
        }
    } catch { $code = 'SERVICE_ROLLBACK_FAILED' }
    $result = @{ success = $false; code = $code }
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
[IO.File]::WriteAllText((Join-Path $Stage 'result.json'), ($result | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
