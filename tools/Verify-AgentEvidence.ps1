[CmdletBinding()]
param(
    [string]$RootDir = (Get-Location).Path,
    [string]$LogDir,
    [switch]$RequireCommandExecution
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-LogDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
        [string]$RequestedLogDir
    )

    if ($RequestedLogDir) {
        if ([System.IO.Path]::IsPathRooted($RequestedLogDir)) {
            return $RequestedLogDir
        }
        return Join-Path $WorkspaceRoot $RequestedLogDir
    }

    $logsRoot = Join-Path $WorkspaceRoot ".agent-logs"
    if (-not (Test-Path -LiteralPath $logsRoot)) {
        throw "Log root not found: $logsRoot"
    }

    $latest = Get-ChildItem -LiteralPath $logsRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) {
        throw "No run directory found under: $logsRoot"
    }

    return $latest.FullName
}

function Read-RunManifest {
    param(
        [Parameter(Mandatory = $true)][string]$RunLogDir
    )

    $manifestPath = Join-Path $RunLogDir "run-manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $null
    }

    return (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json)
}

function Get-TaskEvidenceTargets {
    param(
        [Parameter(Mandatory = $true)]$ManifestTasks,
        [Parameter(Mandatory = $true)][string]$RunLogDir
    )

    if ($ManifestTasks) {
        return @(
            $ManifestTasks | Where-Object { $_.runner -eq "codex" } | ForEach-Object {
                [pscustomobject]@{
                    Agent       = [string]$_.agent
                    JsonLogPath = [string]$_.jsonLog
                    LastMessage = [string]$_.lastMessage
                }
            }
        )
    }

    return @(
        Get-ChildItem -LiteralPath $RunLogDir -Filter "*.jsonl" | ForEach-Object {
            $agent = $_.BaseName -replace "^\d+-", ""
            [pscustomobject]@{
                Agent       = $agent
                JsonLogPath = $_.FullName
                LastMessage = $null
            }
        }
    )
}

function Test-CodexJsonEvidence {
    param(
        [Parameter(Mandatory = $true)][string]$Agent,
        [Parameter(Mandatory = $true)][string]$JsonLogPath,
        [string]$LastMessagePath,
        [Parameter(Mandatory = $true)][bool]$NeedCommandExecution
    )

    $reasons = @()
    if (-not (Test-Path -LiteralPath $JsonLogPath)) {
        return [pscustomobject]@{
            Agent          = $Agent
            Status         = "FAIL"
            Events         = 0
            InvalidJson    = 0
            CommandEvents  = 0
            HasThreadStart = $false
            HasTurnDone    = $false
            HasAgentMsg    = $false
            JsonLog        = $JsonLogPath
            LastMessage    = $LastMessagePath
            Reason         = "json log missing"
        }
    }

    $lines = Get-Content -LiteralPath $JsonLogPath
    $events = @()
    $invalidJsonCount = 0
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if (-not $trimmed) {
            continue
        }

        try {
            $events += ($trimmed | ConvertFrom-Json -ErrorAction Stop)
        }
        catch {
            $invalidJsonCount++
        }
    }

    $hasThreadStart = $false
    $hasTurnDone = $false
    $hasAgentMessage = $false
    $commandEventCount = 0

    foreach ($event in $events) {
        if ($event.type -eq "thread.started") {
            $hasThreadStart = $true
            continue
        }

        if ($event.type -eq "turn.completed") {
            $hasTurnDone = $true
            continue
        }

        if (($event.type -eq "item.started" -or $event.type -eq "item.completed") -and $null -ne $event.item) {
            if ($event.item.type -eq "agent_message") {
                $hasAgentMessage = $true
            }
            if ($event.item.type -eq "command_execution") {
                $commandEventCount++
            }
        }
    }

    if ($events.Count -eq 0) {
        $reasons += "no valid JSON events"
    }
    if (-not $hasThreadStart) {
        $reasons += "missing thread.started"
    }
    if (-not $hasTurnDone) {
        $reasons += "missing turn.completed"
    }
    if (-not $hasAgentMessage) {
        $reasons += "missing agent_message"
    }
    if ($NeedCommandExecution -and $commandEventCount -eq 0) {
        $reasons += "missing command_execution"
    }
    if ($invalidJsonCount -gt 0) {
        $reasons += "invalid JSON lines: $invalidJsonCount"
    }

    if ($LastMessagePath -and -not (Test-Path -LiteralPath $LastMessagePath)) {
        $reasons += "missing last message output file"
    }

    $status = if ($reasons.Count -eq 0) { "PASS" } else { "FAIL" }
    return [pscustomobject]@{
        Agent          = $Agent
        Status         = $status
        Events         = $events.Count
        InvalidJson    = $invalidJsonCount
        CommandEvents  = $commandEventCount
        HasThreadStart = $hasThreadStart
        HasTurnDone    = $hasTurnDone
        HasAgentMsg    = $hasAgentMessage
        JsonLog        = $JsonLogPath
        LastMessage    = $LastMessagePath
        Reason         = ($reasons -join "; ")
    }
}

$resolvedLogDir = Resolve-LogDirectory -WorkspaceRoot $RootDir -RequestedLogDir $LogDir
if (-not (Test-Path -LiteralPath $resolvedLogDir)) {
    throw "Run log directory does not exist: $resolvedLogDir"
}

$manifest = Read-RunManifest -RunLogDir $resolvedLogDir
if ($manifest -and $manifest.dryRun) {
    throw "Selected run is a dry run. Execute Invoke-AgentMonitor without -DryRun and try again. RunDir: $resolvedLogDir"
}

$manifestTasks = if ($manifest) { $manifest.tasks } else { $null }
$targets = @(Get-TaskEvidenceTargets -ManifestTasks $manifestTasks -RunLogDir $resolvedLogDir)

if ($targets.Count -eq 0) {
    throw "No codex evidence targets found in: $resolvedLogDir"
}

$results = @()
foreach ($target in $targets) {
    $results += Test-CodexJsonEvidence -Agent $target.Agent -JsonLogPath $target.JsonLogPath -LastMessagePath $target.LastMessage -NeedCommandExecution ([bool]$RequireCommandExecution)
}
$results = @($results)

Write-Host "RunLogDir: $resolvedLogDir" -ForegroundColor Cyan
$results | Select-Object Agent, Status, Events, InvalidJson, CommandEvents, JsonLog | Format-Table -AutoSize

$failures = @($results | Where-Object { $_.Status -ne "PASS" })
if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Failure details:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host ("- {0}: {1}" -f $failure.Agent, $failure.Reason) -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "Evidence verification passed." -ForegroundColor Green
exit 0
