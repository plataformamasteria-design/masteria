$sourceDir = "C:\Users\Ezequiel Rodrigues\Desktop\master\_railway-pull"
$targetDir = "C:\Users\Ezequiel Rodrigues\Desktop\master\master-ia-oficial-v2-main"

Write-Host "============================================"
Write-Host " 2. MESCLANDO DADOS DA NUVEM                "
Write-Host "============================================"

$protectedRoots = @(
    "whatsmeow-service",
    "baileys-service"
)

$protectedFiles = @(
    "src\components\atendimentos\message-bubble.tsx",
    "src\lib\db\schema.ts",
    "src\app\globals.css",
    ".env",
    ".env.local"
)

# 1. Copiar todos os arquivos da raiz (pacotes, configs), respeitando os protegidos .env
Get-ChildItem -Path $sourceDir -File | ForEach-Object {
    $isProtected = $false
    foreach ($prot in $protectedFiles) {
        if ($_.Name -eq $prot) { $isProtected = $true; break }
    }
    if (-not $isProtected) {
        Copy-Item -Path $_.FullName -Destination "$targetDir\$($_.Name)" -Force
    }
}

# 2. Copiar as pastas da raiz, ignorando node_modules, .git, .next e os serviços protegidos
Get-ChildItem -Path $sourceDir -Directory | ForEach-Object {
    $folderName = $_.Name
    if ($folderName -ne "node_modules" -and $folderName -ne ".git" -and $folderName -ne ".next" -and $protectedRoots -notcontains $folderName) {
        
        # Cópia recursiva manual para respeitar arquivos protegidos lá dentro
        Get-ChildItem -Path $_.FullName -Recurse -File | ForEach-Object {
            $relativePath = $_.FullName.Substring($sourceDir.Length + 1)
            $fullTargetPath = Join-Path $targetDir $relativePath
            $normalizedRelativePath = $relativePath.Replace('/', '\')
            
            $isProtected = $false
            foreach ($prot in $protectedFiles) {
                if ($normalizedRelativePath -eq $prot) { $isProtected = $true; break }
            }
            
            if (-not $isProtected) {
                $targetParent = Split-Path $fullTargetPath -Parent
                if (-not (Test-Path $targetParent)) {
                    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
                }
                Copy-Item -Path $_.FullName -Destination $fullTargetPath -Force
            } else {
                Write-Host "  PRESERVADO: $normalizedRelativePath"
            }
        }
    }
}

Write-Host "============================================"
Write-Host " MERGE FINALIZADO COM SUCESSO!              "
Write-Host "============================================"
