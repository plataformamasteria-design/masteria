$sourceBase = 'comarka-operacional\src\app\trafego'
$destBase = 'src\app\(main)\marketing'

$dirsToCopy = @(
    'ad-intelligence',
    'alertas',
    'anuncios',
    'apresentacao',
    'atribuicao-proporcional',
    'audience-manager',
    'biblioteca',
    'calendario',
    'campanhas',
    'conjuntos',
    'criativos',
    'estrutura',
    'frequencia',
    'funil-cliente',
    'inteligencia',
    'relatorio-auto',
    'relatorios'
)

foreach ($dir in $dirsToCopy) {
    $sourcePath = Join-Path $sourceBase $dir
    $destPath = Join-Path $destBase $dir
    
    if (Test-Path $sourcePath) {
        Write-Host "Copiando $dir..."
        if (Test-Path $destPath) {
            Remove-Item -Recurse -Force $destPath
        }
        Copy-Item -Path $sourcePath -Destination $destBase -Recurse -Force
    }
}

Write-Host "Procurando e substituindo /trafego por /marketing nos arquivos..."
$files = Get-ChildItem -Path $destBase -Recurse -File -Include *.tsx, *.ts
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match '/trafego') {
        $newContent = $content -replace '/trafego', '/marketing'
        $newContent | Set-Content $file.FullName
    }
}
Write-Host "Pronto!"
