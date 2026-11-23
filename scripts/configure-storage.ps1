$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$storageRoot = 'D:\psd_creater-temp'
$phpIni = 'C:\laragon\bin\php\php-8.3.29-nts-Win32-vs16-x64\php.ini'
if (-not (Test-Path -LiteralPath $phpIni -PathType Leaf)) { throw 'Active PHP configuration not found.' }
if ([System.IO.DriveInfo]::new('D:\').AvailableFreeSpace -lt 5GB) { throw 'D drive needs at least 5 GB free.' }
$phpProcesses = @(Get-CimInstance Win32_Process -Filter "name='php-cgi.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path (Split-Path $phpIni) 'php-cgi.exe') })
foreach ($directory in @($storageRoot, (Join-Path $storageRoot 'uploads'), (Join-Path $storageRoot 'conversions'))) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
$backupDir = Join-Path $projectRoot 'storage\app\private'
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$backupPath = Join-Path $backupDir ('php-storage-before-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.ini')
Copy-Item -LiteralPath $phpIni -Destination $backupPath
$iniText = [System.IO.File]::ReadAllText($phpIni)
$uploadSetting = 'upload_tmp_dir = "D:/psd_creater-temp/uploads"'
if ($iniText -match '(?m)^\s*;?\s*upload_tmp_dir\s*=.*$') {
    $iniText = [regex]::Replace($iniText, '(?m)^\s*;?\s*upload_tmp_dir\s*=.*$', $uploadSetting)
} else { $iniText += "`r`n$uploadSetting`r`n" }
[System.IO.File]::WriteAllText($phpIni, $iniText)
$envPath = Join-Path $projectRoot '.env'
$envText = [System.IO.File]::ReadAllText($envPath)
$workSetting = 'PSD_WORK_DIR="D:/psd_creater-temp/conversions"'
if ($envText -match '(?m)^PSD_WORK_DIR=.*$') { $envText = [regex]::Replace($envText, '(?m)^PSD_WORK_DIR=.*$', $workSetting) }
else { $envText += "`r`n$workSetting`r`n" }
[System.IO.File]::WriteAllText($envPath, $envText)
foreach ($phpProcess in $phpProcesses) {
    $command = $phpProcess.CommandLine
    $executableMatch = [regex]::Match($command, '^\s*(?:"[^"]+"|\S+)')
    if (-not $executableMatch.Success) { throw 'Cannot restore PHP process arguments safely.' }
    $arguments = $command.Substring($executableMatch.Length).Trim()
    Stop-Process -Id $phpProcess.ProcessId -ErrorAction Stop
    if ($arguments) { Start-Process -FilePath $phpProcess.ExecutablePath -ArgumentList $arguments -WorkingDirectory (Split-Path $phpIni) -WindowStyle Hidden }
    else { Start-Process -FilePath $phpProcess.ExecutablePath -WorkingDirectory (Split-Path $phpIni) -WindowStyle Hidden }
}
Write-Output ('Configured conversion storage: ' + (Join-Path $storageRoot 'conversions'))
Write-Output ('Configured PHP upload storage: ' + (Join-Path $storageRoot 'uploads'))
Write-Output ('PHP workers restarted: ' + $phpProcesses.Count)
