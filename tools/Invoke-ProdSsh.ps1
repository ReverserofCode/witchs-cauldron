[CmdletBinding()]
param(
    [string]$HostName = $(if ($env:WITCHS_SSH_HOST) { $env:WITCHS_SSH_HOST } else { "moingfans.com" }),
    [int]$Port = $(if ($env:WITCHS_SSH_PORT) { [int]$env:WITCHS_SSH_PORT } else { 22 }),
    [string]$UserName = $env:WITCHS_SSH_USERNAME,
    [string]$DeployPath = $env:WITCHS_DEPLOY_PATH,
    [string]$PasswordFile = ".secrets/prod-ssh-password.secure.txt",
    [string]$KnownHostsFile = $(if ($env:WITCHS_SSH_KNOWN_HOSTS) {
        $env:WITCHS_SSH_KNOWN_HOSTS
    } else {
        Join-Path ([Environment]::GetFolderPath("UserProfile")) ".ssh\known_hosts"
    }),
    [string]$RemoteCommand = "pwd"
)

$ErrorActionPreference = "Stop"

if (-not $UserName) {
    throw "Set WITCHS_SSH_USERNAME or pass -UserName."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([System.IO.Path]::IsPathRooted($PasswordFile)) {
    $passwordPath = $PasswordFile
} else {
    $passwordPath = Join-Path $repoRoot $PasswordFile
}

if (-not (Test-Path -LiteralPath $passwordPath)) {
    throw "Password file not found: $passwordPath"
}

if ([System.IO.Path]::IsPathRooted($KnownHostsFile)) {
    $knownHostsPath = $KnownHostsFile
} else {
    $knownHostsPath = Join-Path $repoRoot $KnownHostsFile
}

if (-not (Test-Path -LiteralPath $knownHostsPath -PathType Leaf)) {
    throw "Known hosts file not found: $knownHostsPath. Verify the server fingerprint out of band before adding it."
}

$securePassword = Get-Content -Raw -LiteralPath $passwordPath | ConvertTo-SecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
}

function Escape-RemoteSingleQuotedPath {
    param([string]$Value)
    return "'" + ($Value -replace "'", "'\''") + "'"
}

$commandToRun = $RemoteCommand
if ($DeployPath) {
    $commandToRun = "cd $(Escape-RemoteSingleQuotedPath $DeployPath) && $RemoteCommand"
}

$env:WITCHS_SSH_HOST_RUNTIME = $HostName
$env:WITCHS_SSH_PORT_RUNTIME = [string]$Port
$env:WITCHS_SSH_USERNAME_RUNTIME = $UserName
$env:WITCHS_SSH_PASSWORD_RUNTIME = $plainPassword
$env:WITCHS_SSH_COMMAND_RUNTIME = $commandToRun
$env:WITCHS_SSH_KNOWN_HOSTS_RUNTIME = [string]$knownHostsPath

try {
    $python = @'
import os
import sys

try:
    import paramiko
except Exception as exc:
    print(f"paramiko is required for tools/Invoke-ProdSsh.ps1: {exc}", file=sys.stderr)
    sys.exit(2)

host = os.environ["WITCHS_SSH_HOST_RUNTIME"]
port = int(os.environ["WITCHS_SSH_PORT_RUNTIME"])
username = os.environ["WITCHS_SSH_USERNAME_RUNTIME"]
password = os.environ["WITCHS_SSH_PASSWORD_RUNTIME"]
command = os.environ["WITCHS_SSH_COMMAND_RUNTIME"]
known_hosts = os.environ["WITCHS_SSH_KNOWN_HOSTS_RUNTIME"]

client = paramiko.SSHClient()
client.load_system_host_keys()
client.load_host_keys(known_hosts)
client.set_missing_host_key_policy(paramiko.RejectPolicy())

try:
    client.connect(
        hostname=host,
        port=port,
        username=username,
        password=password,
        timeout=20,
        banner_timeout=20,
        auth_timeout=20,
        look_for_keys=False,
        allow_agent=False,
    )
    _stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out:
        sys.stdout.write(out)
    if err:
        sys.stderr.write(err)
    sys.exit(stdout.channel.recv_exit_status())
except Exception as exc:
    print(f"ssh command failed: {exc}", file=sys.stderr)
    sys.exit(1)
finally:
    client.close()
'@

    $python | python -
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Remove-Item Env:\WITCHS_SSH_HOST_RUNTIME -ErrorAction SilentlyContinue
    Remove-Item Env:\WITCHS_SSH_PORT_RUNTIME -ErrorAction SilentlyContinue
    Remove-Item Env:\WITCHS_SSH_USERNAME_RUNTIME -ErrorAction SilentlyContinue
    Remove-Item Env:\WITCHS_SSH_PASSWORD_RUNTIME -ErrorAction SilentlyContinue
    Remove-Item Env:\WITCHS_SSH_COMMAND_RUNTIME -ErrorAction SilentlyContinue
    Remove-Item Env:\WITCHS_SSH_KNOWN_HOSTS_RUNTIME -ErrorAction SilentlyContinue
    Remove-Variable plainPassword -ErrorAction SilentlyContinue
}
