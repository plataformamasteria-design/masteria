$sourceVideoDashboard = 'comarka-operacional\src\components\video-dashboard'
$destVideoDashboard = 'src\components\video-dashboard'
$sourceDateContext = 'comarka-operacional\src\contexts\DateFilterContext.tsx'
$destDateContext = 'src\contexts\DateFilterContext.tsx'

Write-Host "Copiando dependencias extras..."
if (Test-Path $sourceVideoDashboard) {
    Copy-Item -Path $sourceVideoDashboard -Destination 'src\components\' -Recurse -Force
}
if (Test-Path $sourceDateContext) {
    Copy-Item -Path $sourceDateContext -Destination $destDateContext -Force
}

Write-Host "Corrigindo imports quebrados na pasta marketing..."
$destBase = 'src\app\(main)\marketing'
$files = Get-ChildItem -Path $destBase -Recurse -File -Include *.tsx, *.ts
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $newContent = $content -replace '@/components/marketing/', '@/components/trafego/'
    $newContent = $newContent -replace '@/app/marketing/', '@/app/(main)/marketing/'
    $newContent = $newContent -replace '@/lib/marketing-ui', '@/lib/trafego-ui'
    if ($content -ne $newContent) {
        $newContent | Set-Content $file.FullName
    }
}
Write-Host "Corrigindo imports quebrados na pasta components/trafego..."
$destComponents = 'src\components\trafego'
$files2 = Get-ChildItem -Path $destComponents -Recurse -File -Include *.tsx, *.ts
foreach ($file in $files2) {
    $content = Get-Content $file.FullName -Raw
    $newContent = $content -replace '@/components/marketing/', '@/components/trafego/'
    $newContent = $newContent -replace '@/app/marketing/', '@/app/(main)/marketing/'
    $newContent = $newContent -replace '@/lib/marketing-ui', '@/lib/trafego-ui'
    if ($content -ne $newContent) {
        $newContent | Set-Content $file.FullName
    }
}

Write-Host "Pronto!"
