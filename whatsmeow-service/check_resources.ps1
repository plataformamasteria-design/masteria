$os = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 1)
$usedGB = $totalGB - $freeGB
$pct = [math]::Round($usedGB / $totalGB * 100, 1)

Write-Host "=== MEMORY ==="
Write-Host "Total: ${totalGB} GB"
Write-Host "Used:  ${usedGB} GB (${pct}%)"
Write-Host "Free:  ${freeGB} GB"
Write-Host ""

Write-Host "=== TOP 10 PROCESSES BY RAM ==="
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 | ForEach-Object {
    $mb = [math]::Round($_.WorkingSet64 / 1MB)
    Write-Host ("{0,-30} {1,6} MB  PID={2}" -f $_.Name, $mb, $_.Id)
}

Write-Host ""
Write-Host "=== NODE.JS PROCESSES ==="
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    $mb = [math]::Round($_.WorkingSet64 / 1MB)
    Write-Host ("PID={0}  RAM={1} MB" -f $_.Id, $mb)
}
