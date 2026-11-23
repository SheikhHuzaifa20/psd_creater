$ErrorActionPreference = 'Stop'
$families = @('cinzeldecorative','playfairdisplay','librebaskerville','manrope','greatvibes','cabin')
$fontRoot = Join-Path $PSScriptRoot '..\resources\fonts'
foreach ($family in $families) {
    $entries = Invoke-RestMethod -Uri "https://api.github.com/repos/google/fonts/contents/ofl/$family" -Headers @{'User-Agent'='PSD-Converter-Font-Assets'}
    foreach ($entry in $entries) {
        if ($entry.name -eq 'OFL.txt' -or ($entry.name.EndsWith('.ttf') -and $entry.name -notmatch 'Italic|Bold|Black')) {
            $name = if ($entry.name -eq 'OFL.txt') { "$family-OFL.txt" } else { $entry.name -replace '\[.*\]', '' }
            Invoke-WebRequest -Uri $entry.download_url -OutFile (Join-Path $fontRoot $name) -UseBasicParsing
            Write-Output "Saved font asset: $name"
        }
    }
}
