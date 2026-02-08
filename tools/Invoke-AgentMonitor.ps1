[CmdletBinding()]
param(
    [ValidateSet("inline", "window")]
    [string]$View = "inline",

    [ValidateSet("intake", "quality", "fullstack-smoke", "custom")]
    [string]$Plan = "quality",

    [ValidateSet("shell", "codex")]
    [string]$Runner = "shell",

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
        [Parameter(Mandatory = $true)][string]$WorkDir,
        [Parameter(Mandatory = $true)][ValidateSet("shell", "codex")][string]$Runner,
        [string]$Command,
        [string]$Prompt
    )

    [pscustomobject]@{
        Index         = $Index
        Agent         = $Agent
        Runner        = $Runner
        Command       = $Command
        Prompt        = $Prompt
        WorkDir       = $WorkDir
        Color         = Get-AgentColor -Agent $Agent
        StreamLogPath = $null
        JsonLogPath   = $null
        MessagePath   = $null
    }
}

function Get-CodexDefaultPrompt {
    param(
        [Parameter(Mandatory = $true)][string]$SelectedPlan,
        [Parameter(Mandatory = $true)][string]$Agent
    )

    switch ("$SelectedPlan::$Agent") {
        "intake::requirements-analyzer" {
            return @"
Follow T0-Intake only. Work as requirements-analyzer.
No file edits.
Return exactly:
[Goal]
[Scope] (include ScopeTag: frontend/backend/fullstack)
[Done]
[Risk]
[Evidence]
"@
        }
        "intake::codebase-structure-analyzer" {
            return @"
Follow T0-Intake only. Work as codebase-structure-analyzer.
No file edits.
Inspect repository structure and impacted directories.
Return exactly:
[Goal]
[Scope]
[Done]
[Risk]
[Evidence]
"@
        }
        "intake::orchestrator-planner" {
            return @"
Follow T0-Intake only. Work as orchestrator-planner.
No file edits.
Synthesize T0 outputs and provide a handoff-ready short plan.
Return exactly:
[Goal]
[Scope]
[Done]
[Risk]
[Evidence]
"@
        }
        "quality::lint-checker" {
            return @"
Work as lint-checker.
Run:
Set-Location frontend; npx tsc --noEmit; npm run lint
No file edits.
Report PASS/FAIL and include key output lines.
"@
        }
        "quality::code-tester" {
            return @"
Work as code-tester.
Run:
Set-Location backend; python -m compileall app
No file edits.
Report PASS/FAIL and include key output lines.
"@
        }
        "quality::dependency-analyzer" {
            return @"
Work as dependency-analyzer.
Run:
Set-Location frontend; npm outdated
No file edits.
Report outdated dependencies and risk summary.
"@
        }
        "quality::code-validator" {
            return @"
Work as code-validator.
No file edits.
Review current changed files and summarize behavioral risks.
Use concrete file references.
"@
        }
        "fullstack-smoke::code-tester" {
            return @"
Work as code-tester.
Run:
docker compose up -d --build
No file edits.
Report container startup summary.
"@
        }
        "fullstack-smoke::lint-checker" {
            return @"
Work as lint-checker.
Run:
Set-Location frontend; npx tsc --noEmit
No file edits.
Report PASS/FAIL and key output lines.
"@
        }
        "fullstack-smoke::documentation-generator" {
            return @"
Work as documentation-generator.
No file edits.
Provide a short release note checklist and rollback/workaround reminder.
"@
        }
        default {
            throw "No codex default prompt for plan '$SelectedPlan' and agent '$Agent'."
        }
    }
}

function Get-DefaultTasks {
    param(
        [Parameter(Mandatory = $true)][string]$SelectedPlan,
        [Parameter(Mandatory = $true)][string]$BaseDir,
        [Parameter(Mandatory = $true)][ValidateSet("shell", "codex")][string]$SelectedRunner
    )

    $tasks = @()
    $i = 1

    if ($SelectedRunner -eq "shell") {
        switch ($SelectedPlan) {
            "intake" {
                $tasks += New-AgentTask -Index $i -Agent "requirements-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Write-Output '[Goal]'; Write-Output '[ScopeTag] frontend/backend/fullstack'; Write-Output '[Done]'; Write-Output '[Risk]'; Write-Output '[Evidence]'"; $i++
                $tasks += New-AgentTask -Index $i -Agent "codebase-structure-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Get-ChildItem frontend/app -Directory | Select-Object -ExpandProperty Name; Get-ChildItem backend/app -Directory | Select-Object -ExpandProperty Name"; $i++
                $tasks += New-AgentTask -Index $i -Agent "orchestrator-planner" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Write-Output 'Workflow: T-Prep -> T0 -> T1 -> T2 -> T3'"; $i++
            }
            "quality" {
                $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Set-Location frontend; npx tsc --noEmit; npm run lint"; $i++
                $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Set-Location backend; python -m compileall app"; $i++
                $tasks += New-AgentTask -Index $i -Agent "dependency-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Set-Location frontend; npm outdated"; $i++
                $tasks += New-AgentTask -Index $i -Agent "code-validator" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Write-Output 'Manual gate: review changed files and API contracts.'"; $i++
            }
            "fullstack-smoke" {
                $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Command "docker compose up -d --build"; $i++
                $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Set-Location frontend; npx tsc --noEmit"; $i++
                $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Command "curl.exe -f http://localhost:3000/api/health; curl.exe -f http://localhost:8000/api/health"; $i++
                $tasks += New-AgentTask -Index $i -Agent "documentation-generator" -WorkDir $BaseDir -Runner $SelectedRunner -Command "Write-Output 'Remember to record rollback/workaround in docs for infra-impact changes.'"; $i++
            }
            default {
                throw "Unsupported default plan: $SelectedPlan"
            }
        }

        return $tasks
    }

    switch ($SelectedPlan) {
        "intake" {
            $tasks += New-AgentTask -Index $i -Agent "requirements-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "requirements-analyzer"); $i++
            $tasks += New-AgentTask -Index $i -Agent "codebase-structure-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "codebase-structure-analyzer"); $i++
            $tasks += New-AgentTask -Index $i -Agent "orchestrator-planner" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "orchestrator-planner"); $i++
        }
        "quality" {
            $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "lint-checker"); $i++
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "code-tester"); $i++
            $tasks += New-AgentTask -Index $i -Agent "dependency-analyzer" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "dependency-analyzer"); $i++
            $tasks += New-AgentTask -Index $i -Agent "code-validator" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "code-validator"); $i++
        }
        "fullstack-smoke" {
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "code-tester"); $i++
            $tasks += New-AgentTask -Index $i -Agent "lint-checker" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "lint-checker"); $i++
            $tasks += New-AgentTask -Index $i -Agent "code-tester" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt @"
Work as code-tester.
Run:
curl.exe -f http://localhost:3000/api/health
curl.exe -f http://localhost:8000/api/health
No file edits.
Report PASS/FAIL and key output lines.
"@; $i++
            $tasks += New-AgentTask -Index $i -Agent "documentation-generator" -WorkDir $BaseDir -Runner $SelectedRunner -Prompt (Get-CodexDefaultPrompt -SelectedPlan $SelectedPlan -Agent "documentation-generator"); $i++
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
        [Parameter(Mandatory = $true)][string]$BaseDir,
        [Parameter(Mandatory = $true)][ValidateSet("shell", "codex")][string]$SelectedRunner
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
        if (-not $item.agent) {
            throw "Each config item must include 'agent'."
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

        if ($SelectedRunner -eq "shell") {
            $taskCommand = if ($item.command) { [string]$item.command } else { [string]$item.prompt }
            if (-not $taskCommand) {
                throw "Each shell task must include 'command' (or 'prompt' fallback)."
            }

            $tasks += New-AgentTask -Index $i -Agent ([string]$item.agent) -WorkDir $taskWorkDir -Runner $SelectedRunner -Command $taskCommand
            $i++
            continue
        }

        $taskPrompt = if ($item.prompt) { [string]$item.prompt } else { [string]$item.command }
        if (-not $taskPrompt) {
            throw "Each codex task must include 'prompt' (or 'command' fallback)."
        }

        $tasks += New-AgentTask -Index $i -Agent ([string]$item.agent) -WorkDir $taskWorkDir -Runner $SelectedRunner -Prompt $taskPrompt
        $i++
    }

    return $tasks
}

function Get-TaskDisplayCommand {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$Task
    )

    if ($Task.Runner -eq "shell") {
        return [string]$Task.Command
    }

    $normalized = ([string]$Task.Prompt -replace "\s+", " ").Trim()
    if ($normalized.Length -gt 110) {
        $normalized = $normalized.Substring(0, 110) + "..."
    }
    return "codex exec --json --cd '$($Task.WorkDir)' `"$normalized`""
}

function Resolve-TaskArtifacts {
    param(
        [Parameter(Mandatory = $true)][System.Collections.ArrayList]$Tasks,
        [Parameter(Mandatory = $true)][string]$LogDir
    )

    foreach ($task in $Tasks) {
        $safeAgent = ($task.Agent -replace "[^a-zA-Z0-9_-]", "_")
        if ($task.Runner -eq "codex") {
            $task.StreamLogPath = Join-Path $LogDir ("{0:D2}-{1}.stream.log" -f $task.Index, $safeAgent)
            $task.JsonLogPath = Join-Path $LogDir ("{0:D2}-{1}.jsonl" -f $task.Index, $safeAgent)
            $task.MessagePath = Join-Path $LogDir ("{0:D2}-{1}.last.txt" -f $task.Index, $safeAgent)
        }
        else {
            $task.StreamLogPath = Join-Path $LogDir ("{0:D2}-{1}.log" -f $task.Index, $safeAgent)
            $task.JsonLogPath = $null
            $task.MessagePath = $null
        }
    }
}

function Write-RunManifest {
    param(
        [Parameter(Mandatory = $true)][System.Collections.ArrayList]$Tasks,
        [Parameter(Mandatory = $true)][string]$LogDir,
        [Parameter(Mandatory = $true)][string]$PlanName,
        [Parameter(Mandatory = $true)][string]$RunnerName,
        [Parameter(Mandatory = $true)][string]$ViewName,
        [Parameter(Mandatory = $true)][string]$WorkspaceRoot,
        [Parameter(Mandatory = $true)][bool]$IsDryRun
    )

    $manifest = @{
        plan      = $PlanName
        runner    = $RunnerName
        view      = $ViewName
        rootDir   = $WorkspaceRoot
        logDir    = $LogDir
        dryRun    = $IsDryRun
        createdAt = (Get-Date).ToString("o")
        tasks     = @(
            $Tasks | ForEach-Object {
                @{
                    index       = $_.Index
                    agent       = $_.Agent
                    runner      = $_.Runner
                    workDir     = $_.WorkDir
                    display     = Get-TaskDisplayCommand -Task $_
                    command     = $_.Command
                    prompt      = $_.Prompt
                    streamLog   = $_.StreamLogPath
                    jsonLog     = $_.JsonLogPath
                    lastMessage = $_.MessagePath
                }
            }
        )
    }

    $manifestPath = Join-Path $LogDir "run-manifest.json"
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath
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
        Write-AgentLine -Task $task -Message ("START  {0}" -f (Get-TaskDisplayCommand -Task $task))
        $job = Start-Job -Name ("agent-{0}-{1}" -f $task.Index, $task.Agent) -ArgumentList $task -ScriptBlock {
            param($Task)

            Set-Location -LiteralPath $Task.WorkDir
            $ErrorActionPreference = "Continue"

            try {
                if ($Task.Runner -eq "codex") {
                    $args = @("exec", "--json", "--skip-git-repo-check", "--cd", $Task.WorkDir)
                    if ($Task.MessagePath) {
                        $args += @("--output-last-message", $Task.MessagePath)
                    }
                    $args += $Task.Prompt

                    & codex @args 2>&1 | ForEach-Object {
                        $line = $_.ToString()
                        if ($line.Trim().Length -gt 0) {
                            Add-Content -LiteralPath $Task.JsonLogPath -Value $line
                            $line
                        }
                    }
                    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
                }
                else {
                    Invoke-Expression $Task.Command 2>&1 | ForEach-Object { $_.ToString() }
                    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
                }
            }
            catch {
                $errorText = $_.ToString()
                if ($Task.Runner -eq "codex" -and $Task.JsonLogPath) {
                    Add-Content -LiteralPath $Task.JsonLogPath -Value $errorText
                }
                $errorText
                $exitCode = 1
            }

            [pscustomobject]@{
                __kind   = "exit"
                Agent    = $Task.Agent
                Index    = $Task.Index
                ExitCode = $exitCode
            }
        }

        $jobs += [pscustomobject]@{
            Task = $task
            Job  = $job
        }
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
                        Add-Content -LiteralPath $task.StreamLogPath -Value $text
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
        $workDirEscaped = $task.WorkDir.Replace("'", "''")
        $streamLogPathEscaped = $task.StreamLogPath.Replace("'", "''")

        if ($task.Runner -eq "codex") {
            $jsonLogPathEscaped = $task.JsonLogPath.Replace("'", "''")
            $messagePathEscaped = $task.MessagePath.Replace("'", "''")
            $prompt = [string]$task.Prompt

            $scriptText = @"
Set-Location -LiteralPath '$workDirEscaped'
`$Host.UI.RawUI.WindowTitle = 'A$($task.Index):$($task.Agent)'
Write-Host '[A$($task.Index):$($task.Agent)] START  $(Get-TaskDisplayCommand -Task $task)' -ForegroundColor $($task.Color)
`$prompt = @'
$prompt
'@
try {
    `$args = @('exec','--json','--skip-git-repo-check','--cd','$workDirEscaped','--output-last-message','$messagePathEscaped')
    `$args += `$prompt
    & codex @args 2>&1 | Tee-Object -FilePath '$jsonLogPathEscaped' | Tee-Object -FilePath '$streamLogPathEscaped'
    `$code = if (`$null -eq `$LASTEXITCODE) { 0 } else { [int]`$LASTEXITCODE }
}
catch {
    `$_.ToString() | Tee-Object -FilePath '$streamLogPathEscaped' -Append
    `$_.ToString() | Tee-Object -FilePath '$jsonLogPathEscaped' -Append
    `$code = 1
}
if (`$code -eq 0) {
    Write-Host '[A$($task.Index):$($task.Agent)] PASS' -ForegroundColor $($task.Color)
}
else {
    Write-Host '[A$($task.Index):$($task.Agent)] FAIL(' + `$code + ')' -ForegroundColor Red
}
"@
        }
        else {
            $scriptText = @"
Set-Location -LiteralPath '$workDirEscaped'
`$Host.UI.RawUI.WindowTitle = 'A$($task.Index):$($task.Agent)'
Write-Host '[A$($task.Index):$($task.Agent)] START  $($task.Command)' -ForegroundColor $($task.Color)
`$cmd = @'
$($task.Command)
'@
try {
    Invoke-Expression `$cmd 2>&1 | Tee-Object -FilePath '$streamLogPathEscaped'
    `$code = if (`$null -eq `$LASTEXITCODE) { 0 } else { [int]`$LASTEXITCODE }
}
catch {
    `$_.ToString() | Tee-Object -FilePath '$streamLogPathEscaped' -Append
    `$code = 1
}
if (`$code -eq 0) {
    Write-Host '[A$($task.Index):$($task.Agent)] PASS' -ForegroundColor $($task.Color)
}
else {
    Write-Host '[A$($task.Index):$($task.Agent)] FAIL(' + `$code + ')' -ForegroundColor Red
}
"@
        }

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

    Get-CustomTasks -SelectedConfigPath $ConfigPath -BaseDir $RootDir -SelectedRunner $Runner
}
else {
    Get-DefaultTasks -SelectedPlan $Plan -BaseDir $RootDir -SelectedRunner $Runner
}

$tasks = [System.Collections.ArrayList]@($tasks)
if ($tasks.Count -eq 0) {
    throw "No tasks to run."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $RootDir (".agent-logs\{0}" -f $timestamp)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Resolve-TaskArtifacts -Tasks $tasks -LogDir $logDir
Write-RunManifest -Tasks $tasks -LogDir $logDir -PlanName $Plan -RunnerName $Runner -ViewName $View -WorkspaceRoot $RootDir -IsDryRun ([bool]$DryRun)

Write-Host "Plan: $Plan / View: $View / Runner: $Runner" -ForegroundColor Cyan
Write-Host "RootDir: $RootDir" -ForegroundColor Cyan
Write-Host "LogDir:  $logDir" -ForegroundColor Cyan
Write-Host ""

foreach ($task in $tasks) {
    Write-AgentLine -Task $task -Message (Get-TaskDisplayCommand -Task $task)
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
