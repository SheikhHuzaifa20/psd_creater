param(
    [ValidateRange(1024, 65535)][int]$Port = 8000,
    [switch]$Standalone
)
$ErrorActionPreference = 'Stop'
if (-not $Standalone) {
    $converterUrl = 'http://localhost/psd_creater/public/'
    try {
        $converterPage = Invoke-WebRequest -Uri $converterUrl -UseBasicParsing -TimeoutSec 5
        if ($converterPage.StatusCode -eq 200 -and $converterPage.Content.Contains('psd_file_input')) {
            Write-Output "Converter is already running in Laragon: $converterUrl"
            exit 0
        }
    } catch { }
}
$uploadDirectory = Join-Path $PSScriptRoot 'storage\app\temp'
$projectEnvPath = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $projectEnvPath) {
    $workMatch = [regex]::Match([System.IO.File]::ReadAllText($projectEnvPath), '(?m)^PSD_WORK_DIR=["'']?([^"''\r\n]+)')
    if ($workMatch.Success) {
        $configuredUploadDirectory = Join-Path (Split-Path $workMatch.Groups[1].Value) 'uploads'
        if (Test-Path -LiteralPath $configuredUploadDirectory -PathType Container) { $uploadDirectory = $configuredUploadDirectory }
    }
}
Push-Location (Join-Path $PSScriptRoot 'public')
try {
    Write-Output "Starting converter: http://127.0.0.1:$Port"
    php -d "upload_tmp_dir=$uploadDirectory" -d upload_max_filesize=1024M -d post_max_size=1050M -d max_execution_time=600 -d max_input_time=600 -d memory_limit=1536M -S "127.0.0.1:$Port" ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
    if ($LASTEXITCODE -ne 0) { throw 'PHP could not open the selected port. Use the running Laragon URL or select another port with -Port.' }
} finally { Pop-Location }
