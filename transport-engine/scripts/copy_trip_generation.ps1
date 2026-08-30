param([switch]$VerifyOnly)

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath 'C:\Users\natachai\Dropbox\2_bangkokModel\BTDS\BTDModel_FN_V10\eBUMpy\tripGeneration').Path
$engineRoot = Split-Path -Parent $PSScriptRoot
$destinationRoot = Join-Path $engineRoot 'reference\trip-generation'
$manifestPath = Join-Path $engineRoot 'reference\trip-generation-manifest.json'

function Get-SourceInventory {
    $paths = @(& rg --files --hidden --glob '!**/__pycache__/**' --glob '!**/.git/**' $sourceRoot)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate Trip Generation.' }
    @($paths | Sort-Object | ForEach-Object {
        $item = Get-Item -LiteralPath $_
        [pscustomobject]@{
            path = $item.FullName.Substring($sourceRoot.Length + 1).Replace('\', '/')
            bytes = $item.Length
            lastWriteUtc = $item.LastWriteTimeUtc.ToString('o')
            sha256 = (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash
        }
    })
}

function Save-Report($Path, $Report) {
    [IO.File]::WriteAllText($Path, ($Report | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
}

if ($VerifyOnly) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.sourceRoot -ne $sourceRoot) { throw 'Manifest root mismatch.' }
    $files = @(Get-SourceInventory)
    if (($files | ConvertTo-Json -Depth 5 -Compress) -cne ($manifest.files | ConvertTo-Json -Depth 5 -Compress)) {
        throw 'Original Trip Generation inventory or file bytes changed.'
    }
    foreach ($file in $files) {
        $copy = Join-Path $destinationRoot $file.path
        if ((Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash -ne $file.sha256) { throw "Copied file changed: $copy" }
    }
    $report = [ordered]@{ verifiedUtc = [DateTime]::UtcNow.ToString('o'); sourceFilesVerified = $files.Count; copyFilesVerified = $files.Count; originalUnchanged = $true; excluded = '__pycache__ only; no original program executed' }
    Save-Report (Join-Path $engineRoot 'reference\trip-generation-verification.json') $report
    $report | ConvertTo-Json
    exit 0
}

if ((Test-Path -LiteralPath $destinationRoot) -or (Test-Path -LiteralPath $manifestPath)) { throw 'Snapshot already exists; use -VerifyOnly. Never overwrite.' }
$files = @(Get-SourceInventory)
foreach ($file in $files) {
    $copy = Join-Path $destinationRoot $file.path
    $fullCopy = [IO.Path]::GetFullPath($copy)
    if (-not $fullCopy.StartsWith([IO.Path]::GetFullPath($destinationRoot) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid destination.' }
    [IO.Directory]::CreateDirectory((Split-Path -Parent $copy)) | Out-Null
    Copy-Item -LiteralPath (Join-Path $sourceRoot $file.path) -Destination $copy
    if ((Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash -ne $file.sha256) { throw "Copy mismatch: $copy" }
}
Save-Report $manifestPath ([ordered]@{ schemaVersion = 1; copiedUtc = [DateTime]::UtcNow.ToString('o'); sourceRoot = $sourceRoot; policy = 'All Trip Generation scripts, data, historical outputs and conflict copies preserved byte-for-byte. No caches, no conflict merging, no original execution.'; files = $files })
[ordered]@{ files = $files.Count; bytes = ($files | Measure-Object -Property bytes -Sum).Sum; destination = $destinationRoot; manifest = $manifestPath } | ConvertTo-Json
