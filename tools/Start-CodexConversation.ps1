[CmdletBinding()]
param(
    [string]$Prompt,

    [switch]$Inline
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function New-CodexArgumentList {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [string]$InitialPrompt
    )

    $args = @(
        "--cd", $Root,
        "--no-alt-screen"
    )

    if ($InitialPrompt) {
        $args += $InitialPrompt
    }

    return ,$args
}

$codexArgs = New-CodexArgumentList -Root $ProjectRoot -InitialPrompt $Prompt

if ($Inline) {
    Set-Location -LiteralPath $ProjectRoot
    & codex @codexArgs
    exit $LASTEXITCODE
}

$encodedCommand = @"
Set-Location -LiteralPath '$($ProjectRoot.Replace("'", "''"))'
`$Host.UI.RawUI.WindowTitle = 'Codex - witchs-cauldron'
& codex @(
$(
    ($codexArgs | ForEach-Object {
        "    '$(([string]$_).Replace("'", "''"))'"
    }) -join ",`n"
)
)
"@

$bytes = [System.Text.Encoding]::Unicode.GetBytes($encodedCommand)
$encoded = [Convert]::ToBase64String($bytes)

Start-Process -FilePath "powershell.exe" -WorkingDirectory $ProjectRoot -ArgumentList "-NoExit", "-EncodedCommand", $encoded | Out-Null
Write-Output "Started a new Codex conversation in: $ProjectRoot"
