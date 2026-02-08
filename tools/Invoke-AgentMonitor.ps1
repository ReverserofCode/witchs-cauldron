[CmdletBinding()]
param(
    [ValidateSet("inline", "window")]
    [string]$View = "inline",

    [ValidateSet("intake", "quality", "fullstack-smoke", "custom")]
    [string]$Plan = "quality",

    [string]$ConfigPath,

    [string]$RootDir = (Get-Location).Path,

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AgentColor {
    param([Parameter(Mandatory = $true)][string]$Agent)

    $palette = @{
        "requirements-analyzer"       = "Yellow"
        "codebase-structure-analyzer" = "Cyan"
        "orchestrator-planner"        = "Green"
        "code-generator"              = "Magenta"
        "external-tool-integrator"    = "Blue"
        "lint-checker"                = "DarkYellow"
        "code-validator"              = "DarkCyan"
        "code-tester"                 = "DarkGreen"
        "dependency-analyzer"         = "DarkMagenta"
        "documentation-generator"     = "White"
        "token-optimizer"             = "Gray"
    }

    if ($palette.ContainsKey($Agent)) {
        return $palette[$Agent]
    }

    return "Gray"
}

function New-AgentTask {
    param(
        [Parameter(Mandatory = $true)][int]$Index,
        [Parameter(Mandatory = $true)][string]$Agent,
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$WorkDir
    )

    [pscustomobject]@{
        Index   = $Index
        Agent   = $Agent
        Command = $Command
        WorkDir = $WorkDir
        Color   = Get-AgentColor -Agent $Agent
    }
}

function Get-DefaultTasks {
    param(
        [Parameter(Mandatory = $true)][string]$SelectedPlan,
        [Parameter(Mandatory = $true)][string]$BaseDir
    )

    $tasks = @()
    $i = 1

    switch ($SelectedPlan) {
        "intake" {
            $tasks += New-AgentTask -Index $i -Agent "requirements-analyzer" -WorkDir $BaseDir -Command "Write-Output '[Goal]'; Write-Output '[ScopeTag] frontend/backend/fullstack'; Write-Output '[Done]'; Write-Output '[Risk]'; Write-Output '[Evidence]'"; $i++
            $tasks += New-AgentTask -Index $i -Agent "codebase-structure-analyzer" -WorkDir $BaseDir -Command "Get-ChildItem frontend/app -Directory | Select-Object -ExpandProperty Name; Get-ChildItem backend/app -Directory | Select-Object -ExpandProperty Name"; $i++
            $tasks += New-AgentTask -Index $i -Agent "orchestrator-planner" -WorkDir $BaseDir -Command "Write-Output 'Workflow: T-Prep -> T0 -> T1 -> T2 -> T3'"; $i++
        }
        "quality" {
            $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Command "Set-Location frontend; npx tsc --noEmit; npm run lint"; $i++
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Command "Set-Location backend; python -m compileall app"; $i++
            $tasks += New-AgentTask -Index $i -Agent "dependency-analyzer" -WorkDir $BaseDir -Command "Set-Location frontend; npm outdated"; $i++
            $tasks += New-AgentTask -Index $i -Agent "code-validator" -WorkDir $BaseDir -Command "Write-Output 'Manual gate: review changed files and API contracts.'"; $i++
        }
        "fullstack-smoke" {
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Command "docker compose up -d --build"; $i++
            $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Command "Set-Location frontend; npx tsc --noEmit"; $i++
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Command "curl.exe -f http://localhost:3000/api/health; curl.exe -f http://localhost:8000/api/health"; $i++
            $tasks += New-AgentTask -Index $i -Agent "documentation-generator" -WorkDir $BaseDir -Command "Write-Output 'Remember to record rollback/workaround in docs for infra-impact changes.'"; $i++
        }
        default {
            throw "Unsupported default plan: $SelectedPlan"
        }
    }

    return $tasks
}

function Get-CustomTasks {
    param(
        [Parameter(Mandatory = $true)][string]$SelectedConfigPath,
        [Parameter(Mandatory = $true)][string]$BaseDir
    )

    if (-not (Test-Path -LiteralPath $SelectedConfigPath)) {
        throw "Config file not found: $SelectedConfigPath"
    }

    $raw = Get-Content -LiteralPath $SelectedConfigPath -Raw
    $parsed = ConvertFrom-Json -InputObject $raw

    if ($parsed -isnot [System.Collections.IEnumerable]) {
        $parsed = @($parsed)
    }

    $tasks = @()
    $i = 1
    foreach ($item in $parsed) {
        if (-not $item.agent -or -not $item.command) {
            throw "Each config item must include 'agent' and 'command'."
        }

        $taskWorkDir = if ($item.workDir) {
            if ([System.IO.Path]::IsPathRooted([string]$item.workDir)) {
                [string]$item.workDir
            }
            else {
                Join-Path $BaseDir ([string]$item.workDir)
            }
        }
        else {
            $BaseDir
        }

        $tasks += New-AgentTask -Index $i -Agent ([string]$item.agent) -Command ([string]$item.command) -WorkDir $taskWorkDir
        $i++
    }

    return $tasks
}

function Write-AgentLine {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$Task,
        [Parameter(Mandatory = $true)][string]$Message
    )

    $prefix = "[A$($Task.Index):$($Task.Agent)]"
    Write-Host "$prefix $Message" -ForegroundColor $Task.Color
}

function Invoke-InlineView {
    param(
        [Parameter(Mandatory = $true)][System.Collections.ArrayList]$Tasks,
        [Parameter(Mandatory = $true)][string]$LogDir
    )

    $jobs = @()
    $results = @()

    foreach ($task in $Tasks) {
        Write-AgentLine -Task $task -Message "START  $($task.Command)"
        $job = Start-Job -Name ("agent-{0}-{1}" -f $task.Index, $task.Agent) -ArgumentList $task.Command, $task.WorkDir, $task.Agent, $task.Index -ScriptBlock {
            param($Command, $WorkDir, $Agent, $Index)
            Set-Location -LiteralPath $WorkDir
            $ErrorActionPreference = "Continue"
            try {
                Invoke-Expression $Command 2>&1 | ForEach-Object { $_.ToString() }
                $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
            }
            catch {
                $_.ToString()
                $exitCode = 1
            }

            [pscustomobject]@{
                __kind   = "exit"
                Agent    = $Agent
                Index    = $Index
                ExitCode = $exitCode
            }
        }

        $jobs += [pscustomobject]@{
            Task = $task
            Job  = $job
        }
    }

    $logPaths = @{}
    foreach ($task in $Tasks) {
        $safeAgent = ($task.Agent -replace "[^a-zA-Z0-9_-]", "_")
        $logPaths[$task.Index] = Join-Path $LogDir ("{0:D2}-{1}.log" -f $task.Index, $safeAgent)
    }

    do {
        $active = $false

        foreach ($item in $jobs) {
            $task = $item.Task
            $job = $item.Job
            $output = Receive-Job -Job $job

            foreach ($line in $output) {
                if ($line -is [pscustomobject] -and $line.PSObject.Properties.Name -contains "__kind" -and $line.__kind -eq "exit") {
                    $results += [pscustomobject]@{
                        Index    = $line.Index
                        Agent    = $line.Agent
                        ExitCode = $line.ExitCode
                    }
                }
                else {
                    $text = [string]$line
                    if ($text.Trim().Length -gt 0) {
                        Write-AgentLine -Task $task -Message $text
                        Add-Content -LiteralPath $logPaths[$task.Index] -Value $text
                    }
                }
            }

            if ($job.State -eq "Running" -or $job.HasMoreData) {
                $active = $true
            }
        }

        Start-Sleep -Milliseconds 120
    } while ($active)

    foreach ($item in $jobs) {
        Receive-Job -Job $item.Job | Out-Null
        Remove-Job -Job $item.Job -Force | Out-Null
    }

    Write-Host ""
    Write-Host "==== Agent Summary ====" -ForegroundColor Cyan
    foreach ($task in $Tasks) {
        $row = $results | Where-Object { $_.Index -eq $task.Index } | Select-Object -First 1
        $code = if ($row) { [int]$row.ExitCode } else { 1 }
        $status = if ($code -eq 0) { "PASS" } else { "FAIL($code)" }
        Write-AgentLine -Task $task -Message $status
    }
    Write-Host "Logs saved to: $LogDir" -ForegroundColor Cyan
}

function Invoke-WindowView {
    param(
        [Parameter(Mandatory = $true)][System.Collections.ArrayList]$Tasks,
        [Parameter(Mandatory = $true)][string]$LogDir
    )

    $shellPath = (Get-Process -Id $PID).Path

    foreach ($task in $Tasks) {
        $safeAgent = ($task.Agent -replace "[^a-zA-Z0-9_-]", "_")
        $logPath = Join-Path $LogDir ("{0:D2}-{1}.log" -f $task.Index, $safeAgent)
        $workDirEscaped = $task.WorkDir.Replace("'", "''")
        $logPathEscaped = $logPath.Replace("'", "''")

        $scriptText = @"
Set-Location -LiteralPath '$workDirEscaped'
`$Host.UI.RawUI.WindowTitle = 'A$($task.Index):$($task.Agent)'
Write-Host '[A$($task.Index):$($task.Agent)] START  $($task.Command)' -ForegroundColor $($task.Color)
`$cmd = @'
$($task.Command)
'@
try {
    Invoke-Expression `$cmd 2>&1 | Tee-Object -FilePath '$logPathEscaped'
    `$code = if (`$null -eq `$LASTEXITCODE) { 0 } else { [int]`$LASTEXITCODE }
}
catch {
    `$_.ToString() | Tee-Object -FilePath '$logPathEscaped' -Append
    `$code = 1
}
if (`$code -eq 0) {
    Write-Host '[A$($task.Index):$($task.Agent)] PASS' -ForegroundColor $($task.Color)
}
else {
    Write-Host '[A$($task.Index):$($task.Agent)] FAIL(' + `$code + ')' -ForegroundColor Red
}
"@

        $bytes = [System.Text.Encoding]::Unicode.GetBytes($scriptText)
        $encoded = [Convert]::ToBase64String($bytes)
        Start-Process -FilePath $shellPath -WorkingDirectory $task.WorkDir -ArgumentList "-NoExit", "-EncodedCommand", $encoded | Out-Null
    }

    Write-Host "Opened $($Tasks.Count) terminal window(s)." -ForegroundColor Cyan
    Write-Host "Logs saved to: $LogDir" -ForegroundColor Cyan
}

$tasks = if ($Plan -eq "custom") {
    if (-not $ConfigPath) {
        throw "Plan 'custom' requires -ConfigPath."
    }

    Get-CustomTasks -SelectedConfigPath $ConfigPath -BaseDir $RootDir
}
else {
    Get-DefaultTasks -SelectedPlan $Plan -BaseDir $RootDir
}

$tasks = [System.Collections.ArrayList]@($tasks)
if ($tasks.Count -eq 0) {
    throw "No tasks to run."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $RootDir (".agent-logs\{0}" -f $timestamp)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Write-Host "Plan: $Plan / View: $View" -ForegroundColor Cyan
Write-Host "RootDir: $RootDir" -ForegroundColor Cyan
Write-Host "LogDir:  $logDir" -ForegroundColor Cyan
Write-Host ""

foreach ($task in $tasks) {
    Write-AgentLine -Task $task -Message $task.Command
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run complete. No command was executed." -ForegroundColor Cyan
    exit 0
}

if ($View -eq "inline") {
    Invoke-InlineView -Tasks $tasks -LogDir $logDir
}
else {
    Invoke-WindowView -Tasks $tasks -LogDir $logDir
}
