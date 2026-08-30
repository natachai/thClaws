param([switch]$VerifyOnly)

# Copy only the explicit TG inputs. Never execute a script in the original model.
$ErrorActionPreference = 'Stop'
$modelRoot = (Resolve-Path -LiteralPath 'C:\Users\natachai\Dropbox\2_bangkokModel\BTDS\BTDModel_FN_V10').Path
$engineRoot = Split-Path -Parent $PSScriptRoot
$fixtureRelative = 'local-fixtures/trip-generation-all-years'
$fixtureRoot = Join-Path $engineRoot $fixtureRelative
$manifestPath = Join-Path $fixtureRoot 'copy-manifest.json'
$years = @(2022, 2027, 2032, 2037, 2042, 2047, 2052, 2057)

function Assert-Contained([string]$Root, [string]$Path) {
    $fullRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $fullPath = [IO.Path]::GetFullPath($Path)
    if (-not $fullPath.StartsWith($fullRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes expected root: $Path"
    }
}

function Write-JsonArtifact([string]$Path, $Value) {
    Assert-Contained $fixtureRoot $Path
    if (Test-Path -LiteralPath $Path) { throw "Refusing to overwrite: $Path" }
    [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
    [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

if ($VerifyOnly) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.sourceRoot -ne $modelRoot) { throw 'Manifest source root mismatch.' }
    foreach ($record in $manifest.copies) {
        $original = Join-Path $modelRoot $record.source
        $copy = Join-Path $engineRoot $record.destination
        Assert-Contained $modelRoot $original
        Assert-Contained $fixtureRoot $copy
        $originalFile = Get-Item -LiteralPath $original
        if ($originalFile.Length -ne $record.bytes -or $originalFile.LastWriteTimeUtc.ToString('o') -ne $record.lastWriteUtc -or (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne $record.sha256) {
            throw "Original changed since copy: $original"
        }
        if ((Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash -ne $record.sha256) { throw "Copied input changed: $copy" }
    }
    foreach ($record in $manifest.generatedFiles) {
        $path = Join-Path $engineRoot $record.path
        Assert-Contained $fixtureRoot $path
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $record.sha256) { throw "Generated request/manifest changed: $path" }
    }
    $report = [ordered]@{
        verifiedUtc = [DateTime]::UtcNow.ToString('o')
        sourceRoot = $modelRoot
        originalFilesVerified = @($manifest.copies).Count
        copiedFilesVerified = @($manifest.copies).Count
        requestsAndBatchVerified = @($manifest.generatedFiles).Count
        years = $years
        originalUnchanged = $true
        scope = 'Only explicitly copied inputs: SHA256, size and original last-write time; no full planning/Project tree claim.'
    }
    $reportName = 'verification-' + [Guid]::NewGuid().ToString('N') + '.json'
    Write-JsonArtifact (Join-Path $fixtureRoot $reportName) $report
    $report | ConvertTo-Json -Depth 5
    exit 0
}

if (Test-Path -LiteralPath $fixtureRoot) { throw 'All-years snapshot already exists; use -VerifyOnly. No overwrite permitted.' }
$common = [ordered]@{
    survey_trip_rate_csv = 'planning/Trip Rate_BTDS2565_SURVEY.csv'
    tour_trip_rate_csv = 'planning/Trip Rate_BTDS2565_TOUR.csv'
    seed_csv = 'planning/BTDS_SEED_CH_NEW.CSV'
    # Reuse the already-reviewed TG settings snapshot; current trpgen copies
    # were inspected read-only and are SHA256-identical. Do not discover paths.
    density_adjustment_csv = 'eBUMpy/tripGeneration/inputs/yr2032_phase5_3_baseline_tg_reproduction/ADJTAB.CSV'
    year_adjustment_csv = 'eBUMpy/tripGeneration/inputs/yr2032_phase5_3_baseline_tg_reproduction/BTDS_YEARADJUST.CSV'
}
$copies = @()
foreach ($key in $common.Keys) {
    $copies += [ordered]@{ key = $key; year = $null; source = $common[$key]; destination = "$fixtureRelative/inputs/common/" + [IO.Path]::GetFileName($common[$key]) }
}
foreach ($year in $years) {
    $copies += [ordered]@{ key = 'demographic_dbf'; year = $year; source = "planning/BTDS planning data $year V2.dbf"; destination = "$fixtureRelative/inputs/$year/BTDS planning data $year V2.dbf" }
    $copies += [ordered]@{ key = 'attraction_dbf'; year = $year; source = "Project/Yr$year/BASE/ATTR_MOD.DBF"; destination = "$fixtureRelative/inputs/$year/ATTR_MOD.DBF" }
}

# Preflight all years before creating any destination. Missing input is an
# error, never a reason to substitute another year's demographic/attraction.
foreach ($record in $copies) {
    $original = Join-Path $modelRoot $record.source
    Assert-Contained $modelRoot $original
    $file = Get-Item -LiteralPath $original
    if ($file.PSIsContainer) { throw "Input is a directory: $original" }
    $record.bytes = $file.Length
    $record.lastWriteUtc = $file.LastWriteTimeUtc.ToString('o')
    $record.sha256 = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
}
foreach ($record in $copies) {
    $original = Join-Path $modelRoot $record.source
    $destination = Join-Path $engineRoot $record.destination
    Assert-Contained $fixtureRoot $destination
    if (Test-Path -LiteralPath $destination) { throw "Refusing to overwrite: $destination" }
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
    Copy-Item -LiteralPath $original -Destination $destination
    if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $record.sha256) { throw "Copy mismatch: $destination" }
}
$batchYears = @()
$generated = @()
foreach ($year in $years) {
    $inputs = [ordered]@{}
    foreach ($record in $copies | Where-Object { $null -eq $_.year -or $_.year -eq $year }) { $inputs[$record.key] = $record.destination }
    $request = [ordered]@{ schemaVersion = 1; actionId = 'transport.trip_generation'; parameters = [ordered]@{ year = $year }; inputs = $inputs }
    $relative = "$fixtureRelative/requests/$year.json"
    $path = Join-Path $engineRoot $relative
    Write-JsonArtifact $path $request
    $generated += [ordered]@{ path = $relative; sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
    $batchYears += [ordered]@{ year = $year; request = $relative }
}
$batchRelative = "$fixtureRelative/batch.json"
$batchPath = Join-Path $engineRoot $batchRelative
Write-JsonArtifact $batchPath ([ordered]@{ schemaVersion = 1; actionId = 'transport.trip_generation'; years = $batchYears })
$generated += [ordered]@{ path = $batchRelative; sha256 = (Get-FileHash -LiteralPath $batchPath -Algorithm SHA256).Hash }
Write-JsonArtifact $manifestPath ([ordered]@{
    schemaVersion = 1
    sourceRoot = $modelRoot
    copiedUtc = [DateTime]::UtcNow.ToString('o')
    policy = 'Original inputs read/copied only. Separate demographic and attraction for every year; 5 shared coefficient inputs unchanged. No original code execution or source writes.'
    years = $years
    copies = $copies
    generatedFiles = $generated
})
[ordered]@{ years = $years; inputFiles = $copies.Count; inputBytes = ($copies | ForEach-Object { $_.bytes } | Measure-Object -Sum).Sum; fixtureRoot = $fixtureRoot; batchRequest = $batchPath; copyManifest = $manifestPath } | ConvertTo-Json -Depth 5
