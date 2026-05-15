$sourceHooks = 'comarka-operacional\src\hooks'
$destHooks = 'src\hooks'
$sourceLib = 'comarka-operacional\src\lib'
$destLib = 'src\lib'
$sourceComponents = 'comarka-operacional\src\components\trafego'
$destComponents = 'src\components\trafego'

Write-Host "Copiando hooks faltantes..."
if (Test-Path $sourceHooks) {
    Copy-Item -Path $sourceHooks\* -Destination $destHooks -Recurse -Force
}

Write-Host "Copiando lib faltantes..."
if (Test-Path $sourceLib) {
    Copy-Item -Path $sourceLib\* -Destination $destLib -Recurse -Force
}

Write-Host "Copiando components/trafego faltantes..."
if (Test-Path $sourceComponents) {
    Copy-Item -Path $sourceComponents\* -Destination $destComponents -Recurse -Force
}

Write-Host "Substituindo /trafego por /marketing nestes arquivos copiados..."
$allDestDirs = @($destHooks, $destLib, $destComponents)
foreach ($dir in $allDestDirs) {
    if (Test-Path $dir) {
        $files = Get-ChildItem -Path $dir -Recurse -File -Include *.tsx, *.ts
        foreach ($file in $files) {
            $content = Get-Content $file.FullName -Raw
            if ($content -match '/trafego') {
                $newContent = $content -replace '/trafego', '/marketing'
                $newContent | Set-Content $file.FullName
            }
        }
    }
}
Write-Host "Concluido!"
