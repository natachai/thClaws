param([switch]$VerifyOnly)

# The original is a READ-ONLY source. All destinations are below this engine.
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath 'C:\Users\natachai\Dropbox\2_bangkokModel\BTDS\BTDModel_FN_V10\eBUMpy').Path
$engineRoot = Split-Path -Parent $PSScriptRoot
$referenceRoot = Join-Path $engineRoot 'reference'
$manifestPath = Join-Path $referenceRoot 'copy-manifest.json'
$scenario = 'yr2032_phase5_3_baseline_tg_reproduction'

function Get-Inventory {
    $entries = @(& rg --files --hidden --glob '!.git/**' --glob '!**/.venv/**' --glob '!**/venv/**' --glob '!**/node_modules/**' $sourceRoot)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate source files with rg.' }
    @($entries | Sort-Object | ForEach-Object {
        $item = Get-Item -LiteralPath $_
        [ordered]@{
            path = $item.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
            bytes = $item.Length
            lastWriteUtc = $item.LastWriteTimeUtc.ToString('o')
        }
    })
}

function Assert-Contained([string]$Root, [string]$Path) {
    $resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    if (-not $resolvedPath.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes intended root: $Path"
    }
}

function Write-JsonArtifact([string]$Path, $Value) {
    Assert-Contained $engineRoot $Path
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

if ($VerifyOnly) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.sourceRoot -ne $sourceRoot) { throw 'Manifest source root mismatch.' }
    $current = @(Get-Inventory)
    $before = @($manifest.sourceInventory)
    if (($current | ConvertTo-Json -Depth 5 -Compress) -cne ($before | ConvertTo-Json -Depth 5 -Compress)) {
        throw 'Original source file inventory/size/last-write metadata changed. Inspect before proceeding.'
    }
    foreach ($record in $manifest.copies) {
        $source = Join-Path $sourceRoot $record.source
        $destination = Join-Path $engineRoot $record.destination
        Assert-Contained $sourceRoot $source
        Assert-Contained $engineRoot $destination
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $record.sha256) { throw "Original bytes changed: $source" }
        if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $record.sha256) { throw "Copied bytes changed: $destination" }
    }
    $verification = [ordered]@{
        verifiedUtc = [DateTime]::UtcNow.ToString('o')
        sourceRoot = $sourceRoot
        allInventoryEntriesUnchanged = $current.Count
        sha256CopiesVerified = @($manifest.copies).Count
        scope = 'All inventoried file names/sizes/last-write times; SHA256 of selected copied files only. Uncopied large data bytes were not hashed.'
    }
    Write-JsonArtifact (Join-Path $referenceRoot 'verification.json') $verification
    $verification | ConvertTo-Json
    exit 0
}

if (Test-Path -LiteralPath $referenceRoot) { throw 'Reference directory already exists. Use -VerifyOnly; this script never overwrites a snapshot.' }
$inventory = @(Get-Inventory)
$codeExtensions = @('.py', '.md', '.rst', '.tex', '.toml', '.ini', '.cfg', '.yaml', '.yml', '.json', '.ps1', '.bat', '.cmd', '.sh')
$selection = @($inventory | Where-Object {
    $_.path -notmatch '(^|/)(__pycache__|outputs|\.git)/' -and
    ($codeExtensions -contains [IO.Path]::GetExtension($_.path).ToLowerInvariant() -or
        [IO.Path]::GetFileName($_.path) -match '^(HOW_TO_RUN|requirements.*|LICENSE.*|README.*)\.txt$')
})
$tasks = @()
foreach ($file in $selection) {
    $tasks += [ordered]@{ source = $file.path; destination = 'reference/eBUMpy/' + $file.path; category = 'reference' }
}
foreach ($kind in @('inputs', 'outputs')) {
    $prefix = "tripGeneration/$kind/$scenario/"
    $destinationKind = if ($kind -eq 'outputs') { 'expected' } else { 'inputs' }
    foreach ($file in $inventory | Where-Object { $_.path.StartsWith($prefix) }) {
        $tasks += [ordered]@{ source = $file.path; destination = "local-fixtures/trip-generation-2032/$destinationKind/" + $file.path.Substring($prefix.Length); category = 'regression' }
    }
}
foreach ($name in @('calculation.py', 'csv_tools.py', 'dbf_reader.py')) {
    $tasks += [ordered]@{ source = "tripGeneration/$name"; destination = "src/thclaws_transport/generation/$name"; category = 'unchanged-runtime-module' }
}
foreach ($task in $tasks) {
    $source = Join-Path $sourceRoot $task.source
    $destination = Join-Path $engineRoot $task.destination
    Assert-Contained $sourceRoot $source
    Assert-Contained $engineRoot $destination
    if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite destination: $destination" }
    $task.sha256 = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $task.bytes = (Get-Item -LiteralPath $source).Length
}
foreach ($task in $tasks) {
    $source = Join-Path $sourceRoot $task.source
    $destination = Join-Path $engineRoot $task.destination
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $task.sha256) { throw "Copy verification failed: $destination" }
}
$manifest = [ordered]@{
    schemaVersion = 1
    copiedUtc = [DateTime]::UtcNow.ToString('o')
    sourceRoot = $sourceRoot
    policy = 'Read-only original; byte-preserved selected reference including conflict copies; no merge, import, CLI execution or installation from original.'
    excluded = @('Generated outputs except selected TG goldens', 'Large GIS/matrices/data except selected TG inputs', '__pycache__ and environments', 'Files outside eBUMpy')
    sourceInventory = $inventory
    copies = $tasks
}
Write-JsonArtifact $manifestPath $manifest
[ordered]@{ inventoryFiles = $inventory.Count; referenceFiles = $selection.Count; referenceConflictCopies = @($selection | Where-Object { $_.path -match 'conflicted copy' }).Count; copiedFiles = $tasks.Count; copiedBytes = ($tasks | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum; manifest = $manifestPath } | ConvertTo-Json
