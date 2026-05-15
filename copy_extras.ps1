$sourceInsight = 'comarka-operacional\src\components\insight-redirect.tsx'
$destInsight = 'src\components\insight-redirect.tsx'
$sourceAlerta = 'comarka-operacional\src\components\alerta-diagnostico-modal.tsx'
$destAlerta = 'src\components\alerta-diagnostico-modal.tsx'

if (Test-Path $sourceInsight) {
    Copy-Item -Path $sourceInsight -Destination $destInsight -Force
    Write-Host "Copiado insight-redirect.tsx"
}
if (Test-Path $sourceAlerta) {
    Copy-Item -Path $sourceAlerta -Destination $destAlerta -Force
    Write-Host "Copiado alerta-diagnostico-modal.tsx"
}
