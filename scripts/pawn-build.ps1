param(
    [Parameter(Mandatory = $true)] [string] $WorkspaceRoot,
    [Parameter(Mandatory = $true)] [string] $SourceFile,
    [ValidateSet("auto", "sampctl", "pawno", "custom")]
    [string] $Mode = "auto"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$source = (Resolve-Path -LiteralPath $SourceFile).Path
$pawnoDir = Join-Path $root "pawno"
$pawnJson = Join-Path $root "pawn.json"
$tasksJson = Join-Path $root ".vscode\tasks.json"
$pawncc = Join-Path $pawnoDir "pawncc.exe"
$pawndisasm = Join-Path $pawnoDir "pawndisasm.exe"
$pawnc = Join-Path $pawnoDir "pawnc.dll"
$includeDir = Join-Path $pawnoDir "include"
$gameModeDir = Join-Path $root "gamemodes"

$hasSampctl = Test-Path -LiteralPath $pawnJson
$hasPawno = (Test-Path -LiteralPath $pawncc) -and (Test-Path -LiteralPath $pawndisasm) -and (Test-Path -LiteralPath $pawnc)
$hasCustom = Test-Path -LiteralPath $tasksJson

function Fail([string] $Message, [int] $Code = 1) {
    Write-Error "[Pawn] $Message"
    exit $Code
}

Write-Host "[Pawn] Workspace: $root"
Write-Host "[Pawn] pawn.json: $hasSampctl"
Write-Host "[Pawn] Pawno toolset: $hasPawno"
Write-Host "[Pawn] Custom tasks: $hasCustom"

if ($Mode -eq "auto") {
    $candidates = @()
    if ($hasSampctl) { $candidates += "sampctl" }
    if ($hasPawno) { $candidates += "pawno" }
    if ($hasCustom) { $candidates += "custom" }
    if ($candidates.Count -eq 0) { Fail "No Pawn build tool detected." }
    if ($candidates.Count -eq 1) {
        $Mode = $candidates[0]
    } else {
        Write-Host "Pawn Build: [1] sampctl  [2] Pawno / PawnCC  [3] Custom (.vscode)"
        $answer = Read-Host "Select"
        $choice = 0
        if (-not [int]::TryParse($answer, [ref] $choice)) { Fail "Build cancelled." 2 }
        if ($choice -lt 1 -or $choice -gt $candidates.Count) { Fail "Invalid selection." 2 }
        $Mode = $candidates[$choice - 1]
    }
}

switch ($Mode) {
    "sampctl" {
        if (-not $hasSampctl) { Fail "pawn.json was not found in this workspace." }
        Write-Host "[Pawn] Running sampctl build"
        & sampctl build
        exit $LASTEXITCODE
    }
    "pawno" {
        if (-not $hasPawno) { Fail "Complete Pawno toolset was not found under workspace\pawno." }
        if (-not (Test-Path -LiteralPath $includeDir)) { Fail "Pawno include directory was not found: $includeDir" }
        if (-not (Test-Path -LiteralPath $gameModeDir)) { New-Item -ItemType Directory -Force -Path $gameModeDir | Out-Null }
        $output = Join-Path $gameModeDir (([IO.Path]::GetFileNameWithoutExtension($source)) + ".amx")
        $args = @($source, "-D$gameModeDir", "-i$includeDir", "-o$output", "-;+", "-(+", "-v2")
        Write-Host "[Pawn] Running $pawncc"
        & $pawncc @args
        exit $LASTEXITCODE
    }
    "custom" {
        if (-not $hasCustom) { Fail ".vscode\tasks.json was not found in this workspace." }
        Fail "Custom .vscode/tasks.json is available. Run the desired workspace task from Zed's Tasks menu." 2
    }
    default { Fail "Unsupported build mode: $Mode" }
}
